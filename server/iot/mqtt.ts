import "dotenv/config";
import mqtt, { type MqttClient } from "mqtt";
import { z } from "zod";

const DEFAULT_MQTT_URL = "mqtt://broker.hivemq.com:1883";
const DEFAULT_TOPICS = ["latex/iot/data", "latex/iot/status", "skripsi/eka/lateks"] as const;

const envSchema = z.object({
  MQTT_URL: z.string().min(1).optional().default(DEFAULT_MQTT_URL),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_CLIENT_ID: z.string().min(1).optional().default("latexguard-dashboard"),
});

const env = envSchema.parse(process.env);

export type MqttMessage = {
  topic: string;
  payload: unknown;
  receivedAt: Date;
};

export function createMqttClient(onMessage: (msg: MqttMessage) => void) {
  const client: MqttClient = mqtt.connect(DEFAULT_MQTT_URL, {
    username: env.MQTT_USERNAME || undefined,
    password: env.MQTT_PASSWORD || undefined,
    clientId: env.MQTT_CLIENT_ID,
    reconnectPeriod: 2000,
    keepalive: 30,
    clean: true,
  });

  client.on("connect", () => {
    console.log("[mqtt] connected");
    client.subscribe([...DEFAULT_TOPICS], { qos: 0 }, (err) => {
      if (err) console.error("[mqtt] subscribe error", err);
      else console.log("[mqtt] subscribed", DEFAULT_TOPICS.join(", "));
    });
  });

  client.on("reconnect", () => console.log("[mqtt] reconnecting..."));
  client.on("close", () => console.log("[mqtt] closed"));
  client.on("error", (err) => console.error("[mqtt] error", err));

  client.on("message", (topic, buf) => {
    const receivedAt = new Date();
    let payload: unknown = null;
    try {
      payload = JSON.parse(buf.toString("utf8"));
    } catch {
      payload = { raw: buf.toString("utf8") };
    }
    onMessage({ topic, payload, receivedAt });
  });

  return client;
}

