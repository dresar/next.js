/**
 * Firmware Latex Monitor ESP32 dengan WiFi + MQTT.
 * Dashboard: broker.hivemq.com:1883, topic latex/iot/data dan latex/iot/status (no auth).
 * Ubah WIFI_SSID dan WIFI_PASS sesuai jaringan Anda.
 */
export const FIRMWARE_CODE = `#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_ADS1X15.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFi.h>
#include <PubSubClient.h>

#define WIFI_SSID "NAMA_WIFI_ANDA"
#define WIFI_PASS "PASSWORD_WIFI_ANDA"

#define MQTT_BROKER "broker.hivemq.com"
#define MQTT_PORT 1883
#define MQTT_TOPIC_DATA "latex/iot/data"
#define MQTT_TOPIC_STATUS "latex/iot/status"

#define DEVICE_ID "esp32-eka"
#define OWNER_NAME "eka"

#define PIN_SUHU 4

Adafruit_SSD1306 display(128, 64, &Wire, -1);
Adafruit_ADS1115 ads;
OneWire oneWire(PIN_SUHU);
DallasTemperature sensorSuhu(&oneWire);

WiFiClient espClient;
PubSubClient client(espClient);

float vAsam = 3.0693;
float vNetral = 2.5950;
float vBasa = 2.2520;

float filterPH = 7.0;
float alpha = 0.15;

float suhuC = 0.0, nilaiTDS = 0.0, nilaiPH = 0.0;
String statusMutu = "";

unsigned long waktuSekarang = 0;
unsigned long waktuUpdateSerial = 0;
unsigned long waktuUpdateMQTT = 0;
unsigned long waktuUpdateStatus = 0;

const long jedaSerial = 1000;
const long jedaMQTT = 7000;

void publishStatus(const char* deviceStatus) {
  String payload =
    String(R"({"device_id":")") + DEVICE_ID +
    String(R"(","owner_name":")") + OWNER_NAME +
    String(R"(","wifi_connected":)") + (WiFi.status() == WL_CONNECTED ? "true" : "false") +
    String(R"(,"mqtt_connected":)") + (client.connected() ? "true" : "false") +
    String(R"(,"status":")") + deviceStatus +
    String(R"(","timestamp":)") + String(millis() / 1000) +
    String("}");

  client.publish(MQTT_TOPIC_STATUS, payload.c_str());
}

void reconnect() {
  while (!client.connected()) {
    Serial.println("Nyambungin MQTT lagi...");
    String clientId = String("latexguard-esp32-") + String((uint32_t)ESP.getEfuseMac(), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("MQTT Konek!");
      publishStatus("boot");
    } else {
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);

  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  ads.begin(0x48);
  ads.setGain(GAIN_ONE);
  sensorSuhu.begin();

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi OK!");

  client.setServer(MQTT_BROKER, MQTT_PORT);
  client.setBufferSize(512);

  display.clearDisplay();
  display.setTextColor(WHITE);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  waktuSekarang = millis();

  sensorSuhu.requestTemperatures();
  suhuC = sensorSuhu.getTempCByIndex(0);
  if (suhuC < 0) suhuC = 27.0;

  int16_t adc3 = ads.readADC_SingleEnded(3);
  float vTDS = ads.computeVolts(adc3);
  nilaiTDS = (133.42 * pow(vTDS, 3)) - (255.86 * pow(vTDS, 2)) + (857.39 * vTDS);
  if (nilaiTDS < 0) nilaiTDS = 0;

  int16_t adc2 = ads.readADC_SingleEnded(2);
  float vPH = ads.computeVolts(adc2);
  float phMentah;

  if (vPH >= vNetral) {
    phMentah = 6.86 - (vPH - vNetral) * (6.86 - 4.00) / (vAsam - vNetral);
  } else {
    phMentah = 6.86 + (vNetral - vPH) * (9.18 - 6.86) / (vNetral - vBasa);
  }

  if (vPH >= (vAsam - 0.03) && vPH <= (vAsam + 0.03)) phMentah = 4.00;
  else if (vPH >= (vNetral - 0.03) && vPH <= (vNetral + 0.03)) phMentah = 6.86;
  else if (vPH >= (vBasa - 0.03) && vPH <= (vBasa + 0.03)) phMentah = 9.18;

  filterPH = (filterPH * (1.0 - alpha)) + (phMentah * alpha);
  nilaiPH = filterPH;

  if (nilaiPH <= 6.0) statusMutu = "ASAM (BURUK)";
  else if (nilaiPH >= 9.0) statusMutu = "AMONIA (AWET)";
  else {
    if (nilaiTDS <= 300) statusMutu = "OPLOS AIR";
    else if (nilaiTDS >= 800) statusMutu = "KONTAMINASI";
    else statusMutu = "PRIMA (OK)";
  }

  if (waktuSekarang - waktuUpdateSerial >= jedaSerial) {
    waktuUpdateSerial = waktuSekarang;

    Serial.print("Volt: ");
    Serial.print(vPH, 3);
    Serial.print(" | pH: ");
    Serial.print(nilaiPH, 2);
    Serial.print(" | TDS: ");
    Serial.print(nilaiTDS, 0);
    Serial.print(" | Suhu: ");
    Serial.print(suhuC, 1);
    Serial.print(" | Mutu: ");
    Serial.println(statusMutu);

    display.clearDisplay();
    if (nilaiTDS > 20) {
      display.setTextSize(2);
      display.setCursor(0, 0);
      display.print("pH: ");
      display.println(nilaiPH, 2);
      display.setTextSize(1);
      display.setCursor(0, 25);
      display.print("TDS : ");
      display.print(nilaiTDS, 0);
      display.println(" ppm");
      display.print("Suhu: ");
      display.print(suhuC, 1);
      display.println(" C");
      display.setCursor(0, 50);
      display.print("M: ");
      display.print(statusMutu);
    } else {
      display.setTextSize(1);
      display.setCursor(20, 25);
      display.println("PROBE DIANGKAT");
      display.setCursor(25, 40);
      display.println("Menunggu Cairan");
    }
    display.display();
  }

  if (waktuSekarang - waktuUpdateStatus >= jedaMQTT) {
    waktuUpdateStatus = waktuSekarang;
    publishStatus(nilaiTDS > 20 ? "liquid_detected" : "probe_dry");
  }

  if (nilaiTDS > 20) {
    if (waktuSekarang - waktuUpdateMQTT >= jedaMQTT) {
      waktuUpdateMQTT = waktuSekarang;

      String deviceStatus = "liquid_detected";
      String payload =
        String(R"({"device_id":")") + DEVICE_ID +
        String(R"(","owner_name":")") + OWNER_NAME +
        String(R"(","ph":)") + String(nilaiPH, 2) +
        String(R"(,"tds":)") + String(nilaiTDS, 0) +
        String(R"(,"temp":)") + String(suhuC, 1) +
        String(R"(,"mutu":")") + statusMutu +
        String(R"(","status":")") + deviceStatus +
        String(R"(","volt":)") + String(vPH, 3) +
        String(R"(,"timestamp":)") + String(millis() / 1000) +
        String("}");

      client.publish(MQTT_TOPIC_DATA, payload.c_str());
      Serial.println(">>> [MQTT] Data berhasil dikirim ke dashboard");
    }
  }
}
`;

export const FIRMWARE_FILENAME = "latex_monitor_esp32.ino";
