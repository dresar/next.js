// ================= PENGATURAN WIFI & MQTT =================
const char* ssid = "eka"; // NAMA WIFI BARU
const char* password = "1234567890"; // PASSWORD WIFI BARU
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char* topic_mutu = "skripsi/eka/lateks";

// ================= PENGATURAN PIN & MODUL =================
#define PIN_SUHU 4

// ================= NILAI KALIBRASI =================
float teganganNetralPH = 0.65;
float stepPH = -0.00877; // <--- UBAH ANGKA INI (jangan lupa tanda MINUS nya)