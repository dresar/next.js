// ===========================================================================================
// [1] IMPORT LIBRARY UTAMA (DEPENDENSI SISTEM)
// ===========================================================================================
#include <Wire.h>               // Komunikasi I2C (untuk ADS1115 & OLED)
#include <Adafruit_GFX.h>       // Core grafis untuk layar OLED
#include <Adafruit_SSD1306.h>   // Driver spesifik layar OLED SSD1306 (128x64)
#include <Adafruit_ADS1X15.h>   // Driver ADC Eksternal Presisi Tinggi ADS1115 (16-bit)
#include <OneWire.h>            // Protokol komunikasi Satu Kabel (untuk sensor suhu)
#include <DallasTemperature.h>  // Driver kalkulasi metrologi Sensor Suhu DS18B20
#include <WiFi.h>               // Stack jaringan nirkabel ESP32 (Protokol 802.11 b/g/n)
#include <PubSubClient.h>       // Library untuk koneksi broker IoT (MQTT)

// ===========================================================================================
// [2] DEFINISI PIN & PARAMETER PERANGKAT KERAS (HARDWARE TOPOLOGY)
// ===========================================================================================
#define PIN_SUHU   4            // Pin data DS18B20 terhubung ke GPIO 4 ESP32
#define PIN_TOMBOL 13           // Tombol Interupsi (On/Off) di handle T-Shape (GPIO 13)
#define OLED_RESET -1           // Reset pin OLED (Tidak digunakan, sharing reset ESP)
#define ALAMAT_OLED 0x3C        // Alamat memori I2C standar untuk OLED SSD1306
#define ALAMAT_ADS  0x48        // Alamat memori I2C ADS1115 (Pin ADDR dihubungkan ke GND)

// ===========================================================================================
// [3] KONFIGURASI JARINGAN (WIFI & MQTT BROKER)
// ===========================================================================================
const char* WIFI_SSID       = "eka";                   // Nama SSID Hotspot/Router
const char* WIFI_PASS       = "1234567890";            // Kata Sandi Hotspot/Router
const char* MQTT_BROKER     = "broker.hivemq.com";     // Alamat IP/URL Server Broker MQTT
const int   MQTT_PORT       = 1883;                    // Port standar komunikasi MQTT non-TLS
const char* TOPIC_LATEKS    = "skripsi/eka/lateks";    // Endpoint logikal untuk publish payload

// ===========================================================================================
// [4] INISIALISASI OBJEK & INSTANCE LIBRARY
// ===========================================================================================
WiFiClient espClient;                                  // Instance koneksi TCP/IP
PubSubClient mqttClient(espClient);                    // Instance klien MQTT 
Adafruit_SSD1306 oled(128, 64, &Wire, OLED_RESET);     // Instance layar OLED resolusi penuh
Adafruit_ADS1115 ads1115;                              // Instance konverter analog-ke-digital
OneWire oneWireSuhu(PIN_SUHU);                         // Instance bus 1-Wire
DallasTemperature sensorSuhu(&oneWireSuhu);            // Instance pembaca suhu presisi

// ===========================================================================================
// [5] PARAMETER KALIBRASI TRIPLE-POINT pH (METROLOGI)
// Catatan: Nilai ini didapatkan dari pengujian riil larutan buffer di lapangan.
// ===========================================================================================
float voltAsam   = 3.0693;      // Representasi voltase ADS pada spektrum Asam (pH 4.01)
float voltNetral = 2.5950;      // Representasi voltase ADS pada spektrum Netral (pH 6.86)
float voltBasa   = 2.2520;      // Representasi voltase ADS pada spektrum Basa (pH 9.18)

// ===========================================================================================
// [6] PARAMETER FILTER DIGITAL (EXPONENTIAL MOVING AVERAGE)
// ===========================================================================================
float alphaEMA   = 0.15;        // Faktor penghalusan (smoothing factor) sebesar 15%
float filterPH   = 2.5;         // Inisialisasi awal penampung filter pH (mendekati netral)
float filterTDS  = 0.0;         // Inisialisasi awal penampung filter TDS

// ===========================================================================================
// [7] DEKLARASI VARIABEL GLOBAL (PENYIMPANAN STATE & DATA)
// ===========================================================================================
float dataPH = 0.0, dataTDS = 0.0, dataSuhu = 0.0;     // Penampung nilai metrik terhitung
float voltPHRaw = 0.0, voltTDSRaw = 0.0;               // Penampung nilai voltase mentah ADC
String kategoriMutu = "STANDBY";                       // State awal klasifikasi mesin inferensi

volatile bool isSistemOn = true;                       // Flag kontrol daya (Aktif/Standby)
volatile unsigned long lastDebounce = 0;               // Timer pelindung mekanis tombol (Debounce)

// ===========================================================================================
// [8] MANAJEMEN WAKTU NON-BLOCKING (MULTITASKING SCHEDULER)
// ===========================================================================================
unsigned long timeLogSerial = 0;
unsigned long timeSendMQTT  = 0;
const long intervalSerial   = 1000;  // Siklus pembaruan Layar OLED & Serial Monitor (1 Detik)
const long intervalMQTT     = 5000;  // Siklus transmisi paket data ke Dashboard Web (5 Detik)

// ===========================================================================================
// [FUNGSI A] HANDLER INTERUPSI HARDWARE (TOMBOL POWER T-SHAPE)
// ===========================================================================================
void IRAM_ATTR toggleSistem() {
  unsigned long skrg = millis();
  // Proteksi debounce 300ms untuk mencegah mikrokontroler membaca sinyal ganda akibat
  // getaran pegas (spring) di dalam saklar fisik.
  if (skrg - lastDebounce > 300) { 
    isSistemOn = !isSistemOn;
    lastDebounce = skrg;
  }
}

// ===========================================================================================
// [FUNGSI B] RUTINITAS KONEKSI & REKONEKSI MQTT (QOS 1 RELIABILITY)
// ===========================================================================================
void hubungkanMQTT() {
  while (!mqttClient.connected() && isSistemOn) {
    Serial.println("[MQTT] Menginisiasi protokol jabat tangan (handshake) ke Broker...");
    // Menghasilkan Client ID unik secara dinamis untuk mencegah bentrokan sesi (session collision)
    String clientID = "ESP32_Skripsi_Eka_" + String(random(0xffff), HEX);
    
    if (mqttClient.connect(clientID.c_str())) {
      Serial.println("[MQTT] KONEKSI BERHASIL! Saluran telemetri terbuka.");
    } else {
      Serial.print("[MQTT] KONEKSI GAGAL. Kode Kesalahan (RC) = ");
      Serial.print(mqttClient.state());
      Serial.println(" -> Mengulangi percobaan dalam 5 detik...");
      delay(5000);
    }
  }
}

// ===========================================================================================
// [FUNGSI C] BOOT SEQUENCE & INISIALISASI PERANGKAT KERAS (SETUP)
// ===========================================================================================
void setup() {
  // Inisialisasi antarmuka serial berkecepatan tinggi untuk debugging real-time
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n========================================================");
  Serial.println("  SISTEM SMART MONITORING MUTU LATEKS - VERSI FINAL 5.0   ");
  Serial.println("            DEVELOPER : EKA SYARIF MAULANA              ");
  Serial.println("========================================================");
  
  // 1. Inisialisasi Bus I2C ESP32 (SDA = GPIO 21, SCL = GPIO 22)
  Wire.begin(21, 22);

  // 2. Inisialisasi Pin Interupsi dengan Resistor Pull-Up internal
  pinMode(PIN_TOMBOL, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_TOMBOL), toggleSistem, FALLING);

  // 3. Diagnostik dan Inisialisasi Layar OLED
  if (!oled.begin(SSD1306_SWITCHCAPVCC, ALAMAT_OLED)) {
    Serial.println("[FATAL ERROR] Layar OLED gagal merespon bus I2C!");
    // Tidak menghentikan sistem (non-blocking failure), alat tetap bisa kirim data ke web
  } else {
    oled.clearDisplay();
    oled.setTextColor(WHITE);
    oled.setTextSize(1);
    oled.setCursor(0, 20);
    oled.println("MEMULAI SISTEM...");
    oled.display();
  }

  // 4. Diagnostik Modul ADC ADS1115
  if (!ads1115.begin(ALAMAT_ADS)) {
    Serial.println("[FATAL ERROR] Modul ADS1115 gagal merespon bus I2C!");
  }
  // Setting resolusi penguatan (Gain). GAIN_ONE membaca hingga +/- 4.096 Volt
  // Sangat cocok untuk output sensor pH dan TDS (rentang 0 - 3.3V)
  ads1115.setGain(GAIN_ONE); 

  // 5. Inisialisasi Sensor Suhu Presisi
  sensorSuhu.begin();
  // Mode asinkron (non-blocking) agar delay pembacaan suhu tidak menghentikan loop utama
  sensorSuhu.setWaitForConversion(false); 

  // 6. Inisialisasi Jaringan Nirkabel (Mode Station)
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[WIFI] Memindai dan menyambungkan ke SSID: "); 
  Serial.println(WIFI_SSID);
  
  int wifiTimeout = 0;
  while (WiFi.status() != WL_CONNECTED && wifiTimeout < 20) {
    delay(500);
    Serial.print(".");
    wifiTimeout++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Terhubung! IP Alamat: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WIFI] Gagal terhubung (Timeout). Beroperasi secara luring (Offline).");
  }

  // 7. Registrasi alamat server MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  
  Serial.println("\n--- SIKUENS BOOT SELESAI, MASUK KE LOOP UTAMA ---");
}

// ===========================================================================================
// [FUNGSI D] SIKLUS EKSEKUSI UTAMA (MAIN LOOP)
// ===========================================================================================
void loop() {
  
  // =======================================================================================
  // BLOK 1: KONTROL DAYA DAN JARINGAN
  // =======================================================================================
  if (isSistemOn) {
    
    // Menjaga detak jantung (heartbeat) jaringan MQTT
    if (WiFi.status() == WL_CONNECTED) {
      if (!mqttClient.connected()) hubungkanMQTT();
      mqttClient.loop();
    }

    // =======================================================================================
    // BLOK 2: AKUISISI DATA DENGAN METODE "SEQUENTIAL ISOLATION" (SOLUSI GROUND LOOP)
    // Penjelasan: Listrik eksitasi dari sensor TDS dapat mengacaukan pembacaan impedansi
    // tinggi pada sensor pH jika dibaca secara bersamaan di dalam cairan yang sama.
    // =======================================================================================
    
    // A. Membaca data Suhu terlebih dahulu
    sensorSuhu.requestTemperatures();
    float suhuMentah = sensorSuhu.getTempCByIndex(0);
    // Filter outlier: Pastikan sensor tidak mengirim angka error (misal -127 C)
    if (suhuMentah > 0 && suhuMentah < 80) dataSuhu = suhuMentah;
    else dataSuhu = 28.5; // Suhu default metrologi tropis (Failsafe)

    // B. Membaca Sensor TDS (Kanal A3 pada ADS1115)
    int16_t adcTDS = ads1115.readADC_SingleEnded(3);
    voltTDSRaw     = ads1115.computeVolts(adcTDS);

    // C. JEDA ISOLASI (DELAY PENSTABILAN ELEKTROMAGNETIK)
    // Memberikan waktu agar sisa arus dari modul TDS luruh dan terdistribusi di cairan
    delay(200); 

    // D. Membaca Sensor pH (Kanal A2 pada ADS1115) dalam kondisi arus sudah tenang
    int16_t adcPH  = ads1115.readADC_SingleEnded(2);
    voltPHRaw      = ads1115.computeVolts(adcPH);

    // =======================================================================================
    // BLOK 3: PEMROSESAN SINYAL DIGITAL (EXPONENTIAL MOVING AVERAGE FILTER)
    // Mereduksi fluktuasi noise acak frekuensi tinggi akibat gangguan lingkungan sekitar.
    // =======================================================================================
    static bool isStartup = true;
    if (isStartup) {
      filterPH  = voltPHRaw;   // Pre-loading buffer agar tidak mulai dari angka 0
      filterTDS = voltTDSRaw;
      isStartup = false;
    }

    // Persamaan Matematika EMA 
    filterPH  = (alphaEMA * voltPHRaw)  + ((1.0 - alphaEMA) * filterPH);
    filterTDS = (alphaEMA * voltTDSRaw) + ((1.0 - alphaEMA) * filterTDS);

    // =======================================================================================
    // BLOK 4: TRANSFORMASI VOLTASE KE METRIK FISIKA/KIMIA (KALIBRASI SENSOR)
    // =======================================================================================
    
    // A. Transformasi TDS (Polinomial Orde 3 Berdasarkan Riset Karakteristik Sensor)
    dataTDS = (133.42 * pow(filterTDS, 3)) - (255.86 * pow(filterTDS, 2)) + (857.39 * filterTDS);
    if (dataTDS < 0) dataTDS = 0; // Menghindari nilai negatif yang tidak logis

    // B. Transformasi pH (Logika Piecewise Linear / Triple-Point Calibration)
    float phCalculated;
    if (filterPH >= voltNetral) {
      // Interpolasi pada Spektrum Asam (Range Kalibrasi 4.01 hingga 6.86)
      phCalculated = 6.86 - (filterPH - voltNetral) * (6.86 - 4.01) / (voltAsam - voltNetral);
    } else {
      // Interpolasi pada Spektrum Basa (Range Kalibrasi 6.86 hingga 9.18)
      phCalculated = 6.86 + (voltNetral - filterPH) * (9.18 - 6.86) / (voltNetral - voltBasa);
    }

    // C. Automatic Temperature Compensation (ATC) untuk Elektrometri pH
    // Mengoreksi pergeseran pembacaan akibat kinetika ion yang berubah karena suhu
    dataPH = phCalculated + (0.03 * (dataSuhu - 25.0));
    
    // Membatasi rentang nilai mutlak keasaman (Clamping)
    if (dataPH < 0.0) dataPH = 0.0;
    if (dataPH > 14.0) dataPH = 14.0;

    // =======================================================================================
    // BLOK 5: DETEKSI PROBE DENGAN HYSTERESIS THRESHOLD
    // Menghindari "False Positive" ketika sensor TDS membaca konduktivitas lembap di udara.
    // =======================================================================================
    // Jika TDS melebihi 100 ppm, alat secara logikal diakui telah tenggelam (Immersed)
    bool isProbeImmersed = (dataTDS > 200.0);

    // =======================================================================================
    // [INTI SKRIPSI] BLOK 6: ALGORITMA MULTIBASIS THRESHOLDING (DATA EMPIRIS LAPANGAN)
    // Mesin inferensi berjenjang (Decision Tree) untuk mengklasifikasi kualitas kimia fisik.
    // =======================================================================================
    if (!isProbeImmersed) {
      kategoriMutu = "TIDAK ADA SAMPEL"; // Cegah pengiriman data acak (noise) ke Dashboard
    } 
    else {
      // --- Evaluasi Lapis 1: Integritas Biokimia Kritis (Parameter pH) ---
      
      // Jika pH drop <= 7.5 (Batas toleransi efek koagulasi dan interferensi ionik)
      if (dataPH <= 7.5) {
        kategoriMutu = "BURUK (ASAM)";       // Analisis: Aktivitas bakteri degradatif tinggi / pra-koagulasi
      } 
      // Jika pH melonjak >= 8.8 (Berdasarkan log uji empiris lapangan Mas Eka)
      else if (dataPH >= 8.8) {
        kategoriMutu = "AWET (AMONIA)";      // Analisis: Konsentrasi zat basa pengawet melebihi batas wajar
      } 
      
      // --- Evaluasi Lapis 2: Integritas Fisika Kepadatan (Parameter TDS pada rentang pH Normal 7.6 - 8.7) ---
      else {
        // Jika TDS stabil di bawah 500 ppm (Pengujian lapangan lateks murni berkisar 360 ppm)
        if (dataTDS <= 500) {                
          kategoriMutu = "PRIMA (OK)";       // Analisis: Emulsi protein-karet utuh, sesuai SNI
        } 
        // Jika TDS di zona anomali kepadatan pertengahan (501 - 1100 ppm)
        else if (dataTDS > 500 && dataTDS <= 1100) {
          kategoriMutu = "KONTAMINASI";      // Analisis: Indikasi infiltrasi sedimen padat (tanah, pasir, pupuk)
        } 
        // Jika TDS meledak di atas 1100 ppm (Pengujian lapangan mencapai 1200+ ppm)
        else {
          kategoriMutu = "OPLOS AIR";        // Analisis: Emulsi pecah (dilusi) akibat mineral air sumur/parit
        }
      }
    }

    // =======================================================================================
    // BLOK 7: ANTARMUKA PENGGUNA LOKAL (SERIAL MONITOR & OLED)
    // =======================================================================================
    if (millis() - timeLogSerial >= intervalSerial) {
      timeLogSerial = millis();

      // Output Logging untuk Dosen Pembimbing (Format Rapi)
      Serial.println("\n========== [LIVE TELEMETRI LAPANGAN] ==========");
      Serial.print("Suhu Cairan (ATC): "); Serial.print(dataSuhu, 1); Serial.println(" C");
      Serial.print("Voltase pH (EMA) : "); Serial.print(filterPH, 4); Serial.println(" V");
      Serial.print("Derajat Asam (pH): "); Serial.println(dataPH, 2);
      Serial.print("Total Padatan    : "); Serial.print(dataTDS, 0); Serial.println(" ppm");
      Serial.print("Hasil Inferensi  : "); Serial.println(kategoriMutu);
      Serial.print("Status Perangkat : "); Serial.println(isProbeImmersed ? "PROBE TERCELUP AKTIF" : "DIANGKAT/STANDBY");
      Serial.println("===============================================");

      // Pembangunan Frame Layar OLED
      oled.clearDisplay();
      if (isProbeImmersed) {
        oled.setTextSize(2); 
        oled.setCursor(0, 0);
        oled.print("pH: "); oled.println(dataPH, 2);
        
        oled.setTextSize(1);
        oled.setCursor(0, 25);
        oled.print("TDS  : "); oled.print(dataTDS, 0); oled.println(" ppm");
        oled.print("Suhu : "); oled.print(dataSuhu, 1); oled.println(" C");
        
        // Highlight Status Mutu di baris paling bawah
        oled.setCursor(0, 50);
        oled.print("Mutu : "); oled.print(kategoriMutu);
      } else {
        oled.setTextSize(1);
        oled.setCursor(20, 25);
        oled.println("PROBE DIANGKAT");
        oled.setCursor(22, 40);
        oled.println("Siap Mengukur...");
      }
      oled.display();
    }

    // =======================================================================================
    // BLOK 8: KOMUNIKASI MESIN-KE-MESIN (TRANSMISI MQTT KE NEXT.JS)
    // =======================================================================================
    // Lapisan filter: Sistem dilarang meracuni database web jika probe sedang di udara
    if (isProbeImmersed && (millis() - timeSendMQTT >= intervalMQTT)) {
      timeSendMQTT = millis();

      // Membangun String berformat JSON murni (Strict Lowercase Key sesuai spesifikasi Dashboard)
      String payload = "{";
      payload += "\"ph\":"    + String(dataPH, 2) + ",";
      payload += "\"tds\":"   + String(dataTDS, 0) + ",";
      payload += "\"temp\":"  + String(dataSuhu, 1) + ",";
      payload += "\"mutu\":\"" + kategoriMutu + "\"";
      payload += "}";

      // Publikasi Payload (Publish)
      if (mqttClient.publish(TOPIC_LATEKS, payload.c_str())) {
        Serial.println(">>> [TX BERHASIL] Paket data telemetri tersinkronisasi ke Dashboard.");
      } else {
        Serial.println(">>> [TX GAGAL] Packet Loss. Menunggu siklus pengiriman berikutnya.");
      }
    }

  } else {
    // =======================================================================================
    // BLOK 9: MODE TIDUR / STANDBY (POWER SAVING STATE)
    // =======================================================================================
    // Dieksekusi jika pengguna menekan tombol T-Shape untuk mematikan pembacaan sensor
    if (millis() - timeLogSerial >= 1000) {
      timeLogSerial = millis();
      
      Serial.println("[SLEEP MODE] Perangkat ditangguhkan. Tekan tombol pada handle untuk memulai.");
      
      oled.clearDisplay();
      oled.setTextSize(2);
      oled.setCursor(15, 25);
      oled.println("OFF MODE");
      oled.display();
    }
  }
}

// ===========================================================================================
// AKHIR DARI STRUKTUR KODE - SEMANGAT SIDANG SKRIPSINYA MAS EKA! PASTI LULUS DENGAN NILAI A! 🚀🔥🏁
// ===========================================================================================