import mqtt from "mqtt";

const HIVEMQ_WS_URL = "wss://broker.hivemq.com:8884/mqtt";
const MQTT_TOPICS = ["skripsi/eka/lateks"];

type RealtimeEvent =
  | { type: "ws:ready" }
  | { type: "measurement:new"; data: any }
  | { type: "measurement:realtime"; data: any } // data MQTT langsung, belum disimpan ke DB
  | { type: "device:status"; data: any }
  | { type: "device:warning"; data: any };

type Listener = (evt: RealtimeEvent) => void;

let mqttClient: mqtt.MqttClient | null = null;
let listeners = new Set<Listener>();

function mapQualityStatus(status: string, ph: number | null, tds: number) {
  // Samakan logika backend dan ESP32 jika mutu tidak masuk akal atau kosong
  if (status && status.trim() !== "") return status.trim();
  
  // Fallback decision tree
  if (tds > 1100) return "Indikasi Oplos Air";
  if (tds > 500 && tds <= 1100) return "Indikasi Kontaminasi";
  if (ph != null) {
      if (ph <= 7.5) return "Mutu Rendah (Asam)";
      if (ph >= 8.8) return "Terawetkan Amonia";
  }
  return "Mutu Prima";
}

function processMqttMessage(topic: string, message: Buffer) {
  try {
    const raw = message.toString();
    const payload = JSON.parse(raw);

    if (topic === "skripsi/eka/lateks") {
      const ph = payload.ph != null ? Number(payload.ph) : null;
      const tds = payload.tds != null ? Number(payload.tds) : 0;
      const temp = payload.temp != null ? Number(payload.temp) : (payload.temperature ?? 0);
      const mutuRaw = payload.mutu ?? payload.quality_status ?? "";
      
      const qualityStatus = mapQualityStatus(mutuRaw, ph, tds);
      
      let probeStatus = "unknown";
      if (mutuRaw.toLowerCase().includes("tidak ada sampel") || tds <= 200) {
        probeStatus = "probe_dry";
      } else {
        probeStatus = "liquid_detected";
      }

      const data = {
        ph_value: ph,
        tds_value: tds,
        temperature: temp,
        quality_status: qualityStatus,
        probe_status: probeStatus,
        device_id: payload.device_id ?? payload.deviceId ?? "esp32-lateks",
        owner_name: payload.owner_name ?? payload.ownerName ?? null,
        source: "mqtt",
        created_at: new Date().toISOString()
      };

      for (const l of listeners) {
        l({ type: "measurement:realtime", data });
      }
    }
  } catch (err) {
    // console.error("Gagal parse MQTT", err);
  }
}

function ensureMqttConnected() {
  if (mqttClient && mqttClient.connected) return;

  if (!mqttClient) {
    mqttClient = mqtt.connect(HIVEMQ_WS_URL, {
      clientId: `latexguard-ui-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 5000,
      keepalive: 30,
    });

    mqttClient.on("connect", () => {
      mqttClient?.subscribe(MQTT_TOPICS, { qos: 0 });
      for (const l of listeners) l({ type: "ws:ready" });
      updateStatus("connected");
    });
    
    mqttClient.on("reconnect", () => updateStatus("connecting"));
    mqttClient.on("offline", () => updateStatus("disconnected"));
    mqttClient.on("error", () => updateStatus("error"));

    mqttClient.on("message", (t, m) => processMqttMessage(t, m));
  }
}

export type MqttStatus = "connecting" | "connected" | "disconnected" | "error";
let currentStatus: MqttStatus = "disconnected";
let statusListeners = new Set<(s: MqttStatus) => void>();

function updateStatus(s: MqttStatus) {
  currentStatus = s;
  for (const l of statusListeners) l(s);
}

export function subscribeMqttStatus(listener: (s: MqttStatus) => void) {
  statusListeners.add(listener);
  listener(currentStatus);
  return () => { statusListeners.delete(listener); };
}

export function subscribeRealtime(listener: Listener) {
  listeners.add(listener);
  ensureMqttConnected();
  return () => {
    listeners.delete(listener);
  };
}

export function reconnectRealtime() {
  if (mqttClient) {
    mqttClient.end(true);
    mqttClient = null;
  }
  ensureMqttConnected();
}
