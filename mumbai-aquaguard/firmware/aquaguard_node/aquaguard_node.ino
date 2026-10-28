/*
  Mumbai AquaGuard - ESP32 monitoring node
  ----------------------------------------
  Measures water depth with an ultrasonic sensor mounted above the road surface,
  watches a manhole cover with a reed switch, reads a rain sensor, and posts a
  JSON reading to the AquaGuard backend over WiFi.

  Wiring (see wiring.md)
    JSN-SR04T / HC-SR04   TRIG -> GPIO 5      ECHO -> GPIO 18 (via divider)
    Reed switch           one leg -> GPIO 19, other leg -> GND  (closed = cover on)
    Rain sensor (analog)  AO -> GPIO 34
    DHT11                 DATA -> GPIO 4
    Buzzer                + -> GPIO 23
    Red LED               + -> GPIO 22 (through 220R)

  Libraries: WiFi, HTTPClient, ArduinoJson (v6), DHT sensor library
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ---------- configuration ----------
const char* WIFI_SSID     = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";

const char* SERVER_URL = "http://192.168.1.10:5000/api/readings";  // your laptop's LAN IP
const char* API_KEY    = "aquaguard-device-key-001";               // must match SENSOR_API_KEY
const char* SENSOR_ID  = "S001";

const float SENSOR_HEIGHT_CM = 60.0;   // distance from sensor face to dry road
const int   SEND_INTERVAL_MS = 10000;
const float LOCAL_ALERT_CM   = 15.0;   // buzzer/LED threshold on the node itself

// ---------- pins ----------
#define TRIG_PIN   5
#define ECHO_PIN   18
#define REED_PIN   19
#define RAIN_PIN   34
#define DHT_PIN    4
#define BUZZER_PIN 23
#define LED_PIN    22

DHT dht(DHT_PIN, DHT11);
unsigned long lastSend = 0;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(REED_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  dht.begin();
  connectWiFi();
}

void loop() {
  if (millis() - lastSend < SEND_INTERVAL_MS) return;
  lastSend = millis();

  float depth = readWaterDepth();
  String cover = readManholeCover();
  float rain = readRainfall();
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  localWarning(depth, cover);

  Serial.printf("depth=%.1f cm  cover=%s  rain=%.1f mm\n", depth, cover.c_str(), rain);
  postReading(depth, cover, rain, temperature, humidity);
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected: " + WiFi.localIP().toString());
}

/* Median of five pings, converted from distance-to-surface into water depth. */
float readWaterDepth() {
  float samples[5];
  for (int i = 0; i < 5; i++) {
    samples[i] = pingDistanceCm();
    delay(60);
  }
  for (int i = 0; i < 4; i++)
    for (int j = i + 1; j < 5; j++)
      if (samples[j] < samples[i]) { float t = samples[i]; samples[i] = samples[j]; samples[j] = t; }

  float distance = samples[2];
  if (distance <= 0 || distance > SENSOR_HEIGHT_CM + 20) return 0.0;  // out of range
  float depth = SENSOR_HEIGHT_CM - distance;
  return depth < 0 ? 0 : depth;
}

float pingDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);  // 30 ms timeout
  if (duration == 0) return -1;
  return duration * 0.0343 / 2.0;
}

/* Reed switch closes against the magnet fitted to the cover. Open circuit = cover moved. */
String readManholeCover() {
  int state = digitalRead(REED_PIN);        // LOW = magnet present = cover closed
  return state == LOW ? "CLOSED" : "OPEN";
}

/* Cheap resistive rain sensors read high when dry; map to a rough mm/h figure. */
float readRainfall() {
  int raw = analogRead(RAIN_PIN);           // 0..4095
  float wetness = (4095.0 - raw) / 4095.0;
  return wetness * 60.0;
}

void localWarning(float depth, String cover) {
  bool danger = depth >= LOCAL_ALERT_CM || cover == "OPEN";
  digitalWrite(LED_PIN, danger ? HIGH : LOW);
  if (danger) {
    tone(BUZZER_PIN, 2000, 300);
  }
}

void postReading(float depth, String cover, float rain, float temperature, float humidity) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  StaticJsonDocument<256> doc;
  doc["sensorId"] = SENSOR_ID;
  doc["waterDepth"] = depth;
  doc["manholeCover"] = cover;
  doc["rainfall"] = rain;
  if (!isnan(temperature)) doc["temperature"] = temperature;
  if (!isnan(humidity)) doc["humidity"] = humidity;
  doc["batteryLevel"] = 100;
  doc["status"] = "OK";

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  int code = http.POST(body);
  Serial.printf("POST -> %d\n", code);
  http.end();
}
