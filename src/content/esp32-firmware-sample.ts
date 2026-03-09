/**
 * Firmware Latex Monitor ESP32 dengan WiFi + MQTT.
 * Dashboard: broker.hivemq.com:1883, topic latex/iot/data (no auth).
 * Ubah WIFI_SSID dan WIFI_PASS sesuai jaringan Anda.
 */
export const FIRMWARE_CODE = `#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define BUTTON_PIN 18
#define TDS_PIN 35
#define ONE_WIRE_BUS 4

// ========== UBAH SESUAI JARINGAN ANDA ==========
#define WIFI_SSID "NAMA_WIFI_ANDA"
#define WIFI_PASS "PASSWORD_WIFI_ANDA"
// ==============================================

#define MQTT_BROKER "broker.hivemq.com"
#define MQTT_PORT 1883
#define MQTT_TOPIC_DATA "latex/iot/data"
#define MQTT_TOPIC_STATUS "latex/iot/status"

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
WiFiClient espClient;
PubSubClient mqtt(espClient);

bool buttonState;
bool lastButtonState = HIGH;
float temperature = 0;
float tds = 0;
float voltage = 0;
bool probe = false;

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Wire.begin(21, 22);
  delay(500);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED ERROR");
    while (true);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.setCursor(0, 0);
  display.println("LATEX MONITOR");
  display.setCursor(0, 20);
  display.println("SYSTEM READY");
  display.display();
  Serial.println("SYSTEM READY");
  sensors.begin();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  int w = 0;
  while (WiFi.status() != WL_CONNECTED && w < 30) {
    delay(500);
    Serial.print(".");
    w++;
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi OK: " + WiFi.localIP().toString());
  } else {
    Serial.println("WiFi FAIL - cek SSID/Password");
  }

  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setBufferSize(256);
}

void publishToDashboard() {
  if (!mqtt.connected()) {
    String clientId = "latex-esp32-" + String(random(0xffff), HEX);
    if (mqtt.connect(clientId.c_str())) {
      Serial.println("MQTT connected");
      StaticJsonDocument<128> st;
      st["mqtt_connected"] = true;
      st["wifi_connected"] = true;
      char buf[128];
      serializeJson(st, buf);
      mqtt.publish(MQTT_TOPIC_STATUS, buf);
    } else {
      Serial.println("MQTT fail");
      return;
    }
  }
  mqtt.loop();

  StaticJsonDocument<256> doc;
  doc["temp"] = round(temperature * 10) / 10.0;
  doc["tds"] = (int)tds;
  doc["volt"] = round(voltage * 100) / 100.0;
  doc["battery"] = 100;
  doc["status"] = probe ? "liquid_detected" : "probe_dry";
  doc["timestamp"] = millis() / 1000;

  char buf[256];
  serializeJson(doc, buf);
  if (mqtt.publish(MQTT_TOPIC_DATA, buf)) {
    Serial.println("Published: " + String(buf));
  } else {
    Serial.println("Publish fail");
  }
}

float readTDS() {
  int adc = analogRead(TDS_PIN);
  voltage = adc * (3.3 / 4095.0);
  probe = (voltage > 0.08);
  return voltage * 500;
}

void readTemperature() {
  sensors.requestTemperatures();
  float t = sensors.getTempCByIndex(0);
  if (t != -127) temperature = t;
}

void showResult() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("Temp: ");
  display.print(temperature);
  display.setCursor(0, 20);
  display.print("TDS : ");
  display.print(tds);
  display.display();
}

void loop() {
  buttonState = digitalRead(BUTTON_PIN);

  if (buttonState == LOW && lastButtonState == HIGH) {
    Serial.println("BUTTON PRESSED");
    tds = readTDS();

    if (!probe) {
      Serial.println("PROBE NOT DETECTED");
      display.clearDisplay();
      display.setCursor(0, 20);
      display.println("INSERT PROBE");
      display.display();
      delay(2000);
    } else {
      Serial.println("PROBE DETECTED");
      readTemperature();
      Serial.print("Temperature: ");
      Serial.println(temperature);
      Serial.print("TDS: ");
      Serial.println(tds);
      showResult();
      publishToDashboard();
    }
  }

  if (buttonState == HIGH && lastButtonState == LOW) {
    Serial.println("BUTTON RELEASED");
  }

  lastButtonState = buttonState;
  delay(50);
}
`;

export const FIRMWARE_FILENAME = "latex_monitor_esp32.ino";
