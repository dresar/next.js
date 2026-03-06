import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { z } from "zod";
import http from "node:http";
import { pool } from "./db/pool";
import { signAccessToken } from "./auth/jwt";
import { requireAuth, type AuthedRequest } from "./middleware/auth";
import { createMqttClient } from "./iot/mqtt";
import { getDeviceId, iotDataSchema, iotStatusSchema, normalizeTimestamp } from "./iot/parser";
import { classifyLatexQuality, probeStatusFromDeviceStatus } from "./iot/classify";
import { attachWebsocketServer, broadcastJson } from "./realtime/ws";

const envSchema = z.object({
  PORT: z.coerce.number().optional().default(3001),
  DEVICE_OFFLINE_SECONDS: z.coerce.number().optional().default(60),
});
const env = envSchema.parse(process.env);

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --- IoT ingest (MQTT) ---
createMqttClient(async ({ topic, payload, receivedAt }) => {
  try {
    if (topic === "latex/iot/data") {
      const parsed = iotDataSchema.safeParse(payload);
      if (!parsed.success) return;
      const p = parsed.data;
      const deviceId = getDeviceId(p);
      const createdAt = normalizeTimestamp(p.timestamp);
      const ownerName = (p.owner_name ?? p.ownerName ?? "Unknown").toString();
      const firmwareVersion = p.firmware_version ?? p.firmware ?? null;

      const qualityStatus = classifyLatexQuality({ ph: null, tds: p.tds });
      const deviceStatus = p.status ?? null;
      const probeStatus = probeStatusFromDeviceStatus(deviceStatus);

      const inserted = await pool.query(
        `
        INSERT INTO public.latex_measurements
          (user_id, owner_name, ph_value, tds_value, temperature, quality_status, latitude, longitude,
           device_id, voltage_probe, battery_level, device_status, probe_status, firmware_version, source, created_at)
        VALUES
          (NULL, $1, NULL, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12, 'mqtt', $13)
        RETURNING
          id,
          device_id,
          owner_name,
          tds_value,
          temperature,
          voltage_probe,
          battery_level,
          device_status,
          probe_status,
          quality_status,
          latitude,
          longitude,
          firmware_version,
          created_at
        `,
        [
          ownerName,
          Math.round(p.tds),
          p.temperature,
          qualityStatus,
          p.latitude ?? null,
          p.longitude ?? null,
          deviceId,
          p.voltage ?? null,
          p.battery ?? null,
          deviceStatus,
          probeStatus,
          firmwareVersion,
          createdAt,
        ]
      );

      const measurement = inserted.rows[0];

      await pool.query(
        `
        INSERT INTO public.devices (id, mqtt_connected, wifi_connected, battery_level, firmware_version, last_seen, last_data_at, last_status, last_status_at)
        VALUES ($1, true, NULL, $2, $3, $4, $4, $5, $4)
        ON CONFLICT (id) DO UPDATE SET
          mqtt_connected = EXCLUDED.mqtt_connected,
          battery_level = COALESCE(EXCLUDED.battery_level, public.devices.battery_level),
          firmware_version = COALESCE(EXCLUDED.firmware_version, public.devices.firmware_version),
          last_seen = EXCLUDED.last_seen,
          last_data_at = EXCLUDED.last_data_at,
          last_status = COALESCE(EXCLUDED.last_status, public.devices.last_status),
          last_status_at = EXCLUDED.last_status_at
        `,
        [deviceId, p.battery ?? null, firmwareVersion, receivedAt, deviceStatus]
      );

      await pool.query(
        `
        INSERT INTO public.device_logs (device_id, topic, payload, received_at, measurement_id)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [deviceId, topic, payload as any, receivedAt, measurement.id]
      );

      broadcastJson({ type: "measurement:new", data: measurement });

      if (deviceStatus && ["temp_error", "probe_dry", "sensor_disconnected"].some((x) => deviceStatus.includes(x))) {
        broadcastJson({ type: "device:warning", data: { device_id: deviceId, status: deviceStatus, at: receivedAt.toISOString() } });
      }
    } else if (topic === "latex/iot/status") {
      const parsed = iotStatusSchema.safeParse(payload);
      if (!parsed.success) return;
      const p = parsed.data;
      const deviceId = getDeviceId(p);
      const at = normalizeTimestamp(p.timestamp);
      const firmwareVersion = p.firmware_version ?? p.firmware ?? null;

      const wifi = p.wifi_connected ?? p.wifi ?? null;
      const mqttConnected = p.mqtt_connected ?? p.mqtt ?? null;
      const deviceStatus = p.status ?? null;

      await pool.query(
        `
        INSERT INTO public.devices (id, wifi_connected, mqtt_connected, battery_level, firmware_version, last_seen, last_status_at, last_status)
        VALUES ($1, $2, $3, $4, $5, $6, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          wifi_connected = COALESCE(EXCLUDED.wifi_connected, public.devices.wifi_connected),
          mqtt_connected = COALESCE(EXCLUDED.mqtt_connected, public.devices.mqtt_connected),
          battery_level = COALESCE(EXCLUDED.battery_level, public.devices.battery_level),
          firmware_version = COALESCE(EXCLUDED.firmware_version, public.devices.firmware_version),
          last_seen = EXCLUDED.last_seen,
          last_status_at = EXCLUDED.last_status_at,
          last_status = COALESCE(EXCLUDED.last_status, public.devices.last_status)
        `,
        [deviceId, wifi, mqttConnected, p.battery ?? null, firmwareVersion, receivedAt, deviceStatus]
      );

      await pool.query(
        `INSERT INTO public.device_logs (device_id, topic, payload, received_at) VALUES ($1, $2, $3, $4)`,
        [deviceId, topic, payload as any, receivedAt]
      );

      broadcastJson({
        type: "device:status",
        data: {
          device_id: deviceId,
          wifi_connected: wifi,
          mqtt_connected: mqttConnected,
          battery_level: p.battery ?? null,
          firmware_version: firmwareVersion,
          status: deviceStatus,
          at: at.toISOString(),
        },
      });
    }
  } catch (err) {
    console.error("[mqtt] handler error", err);
  }
});

app.post("/api/auth/login", async (req, res) => {
  const bodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });

  const { email, password } = body.data;
  const userRes = await pool.query<{ id: string; email: string; password_hash: string }>(
    `SELECT id, email, password_hash FROM public.users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()]
  );
  const user = userRes.rows[0];
  if (!user) return res.status(401).json({ error: "Email atau password salah" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Email atau password salah" });

  const token = signAccessToken({ id: user.id, email: user.email });
  return res.json({ token, user: { id: user.id, email: user.email } });
});

app.get("/api/auth/me", requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.auth!;
  const profileRes = await pool.query<{
    full_name: string | null;
    phone: string | null;
    address: string | null;
    avatar_url: string | null;
  }>(
    `SELECT full_name, phone, address, avatar_url FROM public.profiles WHERE user_id = $1 LIMIT 1`,
    [auth.id]
  );

  return res.json({
    user: { id: auth.id, email: auth.email },
    profile: profileRes.rows[0] ?? { full_name: null, phone: null, address: null, avatar_url: null },
  });
});

app.get("/api/profile", requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.auth!;
  const profileRes = await pool.query<{
    full_name: string | null;
    phone: string | null;
    address: string | null;
    avatar_url: string | null;
  }>(
    `SELECT full_name, phone, address, avatar_url FROM public.profiles WHERE user_id = $1 LIMIT 1`,
    [auth.id]
  );
  return res.json(profileRes.rows[0] ?? { full_name: null, phone: null, address: null, avatar_url: null });
});

app.put("/api/profile", requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.auth!;
  const bodySchema = z.object({
    full_name: z.string().trim().max(200).nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
  });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });

  const fullName = body.data.full_name ?? null;
  const phone = body.data.phone ?? null;
  const address = body.data.address ?? null;

  await pool.query(
    `
    INSERT INTO public.profiles (user_id, full_name, phone, address)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address
    `,
    [auth.id, fullName, phone, address]
  );

  return res.json({ ok: true });
});

app.post("/api/profile/password", requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.auth!;
  const bodySchema = z.object({
    newPassword: z.string().min(6),
  });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Password minimal 6 karakter" });

  const passwordHash = await bcrypt.hash(body.data.newPassword, 10);
  await pool.query(`UPDATE public.users SET password_hash = $1 WHERE id = $2`, [passwordHash, auth.id]);
  return res.json({ ok: true });
});

app.get("/api/measurements", requireAuth, async (req: AuthedRequest, res) => {
  const qSchema = z.object({
    owner: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    quality_status: z.string().optional(),
    limit: z.coerce.number().optional().default(500),
  });
  const q = qSchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid query" });

  const limit = Math.min(Math.max(q.data.limit, 1), 5000);
  const where: string[] = [];
  const values: any[] = [];

  if (q.data.owner) {
    values.push(`%${q.data.owner}%`);
    where.push(`owner_name ILIKE $${values.length}`);
  }
  if (q.data.quality_status && q.data.quality_status !== "all") {
    values.push(q.data.quality_status);
    where.push(`quality_status = $${values.length}`);
  }
  if (q.data.from) {
    values.push(new Date(q.data.from));
    where.push(`created_at >= $${values.length}`);
  }
  if (q.data.to) {
    values.push(new Date(q.data.to));
    where.push(`created_at <= $${values.length}`);
  }

  values.push(limit);

  const rows = await pool.query(
    `
    SELECT
      id,
      user_id,
      owner_name,
      ph_value::float8 as ph_value,
      tds_value,
      temperature::float8 as temperature,
      quality_status,
      latitude::float8 as latitude,
      longitude::float8 as longitude,
      voltage_probe::float8 as voltage_probe,
      battery_level::float8 as battery_level,
      device_id,
      device_status,
      probe_status,
      firmware_version,
      source,
      created_at
    FROM public.latex_measurements
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY created_at DESC
    LIMIT $${values.length}
    `,
    values
  );
  return res.json(rows.rows);
});

app.get("/api/measurements.csv", requireAuth, async (req: AuthedRequest, res) => {
  const qSchema = z.object({
    owner: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    quality_status: z.string().optional(),
  });
  const q = qSchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid query" });

  const where: string[] = [];
  const values: any[] = [];

  if (q.data.owner) {
    values.push(`%${q.data.owner}%`);
    where.push(`owner_name ILIKE $${values.length}`);
  }
  if (q.data.quality_status && q.data.quality_status !== "all") {
    values.push(q.data.quality_status);
    where.push(`quality_status = $${values.length}`);
  }
  if (q.data.from) {
    values.push(new Date(q.data.from));
    where.push(`created_at >= $${values.length}`);
  }
  if (q.data.to) {
    values.push(new Date(q.data.to));
    where.push(`created_at <= $${values.length}`);
  }

  const rows = await pool.query(
    `
    SELECT
      created_at,
      device_id,
      owner_name,
      temperature,
      tds_value,
      voltage_probe,
      battery_level,
      probe_status,
      device_status,
      quality_status,
      latitude,
      longitude
    FROM public.latex_measurements
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY created_at DESC
    LIMIT 10000
    `,
    values
  );

  const header = [
    "created_at",
    "device_id",
    "owner_name",
    "temperature",
    "tds_value",
    "voltage_probe",
    "battery_level",
    "probe_status",
    "device_status",
    "quality_status",
    "latitude",
    "longitude",
  ];

  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replaceAll("\"", "\"\"")}"`;
    return s;
  };

  const lines = [header.join(",")];
  for (const r of rows.rows as any[]) {
    lines.push(header.map((k) => escape(r[k])).join(","));
  }

  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", "attachment; filename=\"latex_measurements.csv\"");
  return res.send(lines.join("\n"));
});

app.post("/api/measurements", requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.auth!;
  const bodySchema = z.object({
    ownerName: z.string().trim().min(1).max(200),
    ph: z.number().nullable().optional(),
    tds: z.number().int(),
    temperature: z.number(),
    voltage: z.number().nullable().optional(),
    battery: z.number().nullable().optional(),
    deviceId: z.string().trim().min(1).optional(),
    deviceStatus: z.string().trim().min(1).optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });

  const qualityStatus = classifyLatexQuality({ ph: body.data.ph ?? null, tds: body.data.tds });
  const probeStatus = probeStatusFromDeviceStatus(body.data.deviceStatus ?? null);

  const inserted = await pool.query(
    `
    INSERT INTO public.latex_measurements
      (user_id, owner_name, ph_value, tds_value, temperature, quality_status, latitude, longitude,
       device_id, voltage_probe, battery_level, device_status, probe_status, source)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8,
       $9, $10, $11, $12, $13, 'manual')
    RETURNING
      id,
      user_id,
      owner_name,
      ph_value::float8 as ph_value,
      tds_value,
      temperature::float8 as temperature,
      quality_status,
      latitude::float8 as latitude,
      longitude::float8 as longitude,
      voltage_probe::float8 as voltage_probe,
      battery_level::float8 as battery_level,
      device_id,
      device_status,
      probe_status,
      firmware_version,
      source,
      created_at
    `,
    [
      auth.id,
      body.data.ownerName,
      body.data.ph ?? null,
      body.data.tds,
      body.data.temperature,
      qualityStatus,
      body.data.latitude ?? null,
      body.data.longitude ?? null,
      body.data.deviceId ?? null,
      body.data.voltage ?? null,
      body.data.battery ?? null,
      body.data.deviceStatus ?? null,
      probeStatus,
    ]
  );

  broadcastJson({ type: "measurement:new", data: inserted.rows[0] });
  return res.json(inserted.rows[0]);
});

app.patch("/api/measurements/:id", requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.auth!;
  const id = req.params.id;
  const bodySchema = z.object({
    owner_name: z.string().trim().min(1).max(200),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });

  const updated = await pool.query(
    `
    UPDATE public.latex_measurements
    SET owner_name = $1, latitude = $2, longitude = $3
    WHERE id = $4
    RETURNING id, owner_name, latitude::float8 as latitude, longitude::float8 as longitude, tds_value, temperature::float8 as temperature, quality_status, created_at
    `,
    [body.data.owner_name, body.data.latitude ?? null, body.data.longitude ?? null, id]
  );
  if (updated.rowCount === 0) return res.status(404).json({ error: "Measurement not found" });
  const row = updated.rows[0] as any;
  broadcastJson({ type: "measurement:updated", data: row });
  return res.json(row);
});

app.get("/api/devices", requireAuth, async (_req: AuthedRequest, res) => {
  const rows = await pool.query(
    `
    SELECT
      id,
      wifi_connected,
      mqtt_connected,
      battery_level::float8 as battery_level,
      firmware_version,
      last_seen,
      last_data_at,
      last_status_at,
      last_status
    FROM public.devices
    ORDER BY last_seen DESC NULLS LAST
    `
  );
  return res.json({ offline_after_seconds: env.DEVICE_OFFLINE_SECONDS, devices: rows.rows });
});

app.get("/api/device-logs", requireAuth, async (req: AuthedRequest, res) => {
  const qSchema = z.object({
    device_id: z.string().optional(),
    limit: z.coerce.number().optional().default(200),
  });
  const q = qSchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid query" });

  const limit = Math.min(Math.max(q.data.limit, 1), 1000);
  const deviceId = q.data.device_id;

  const rows = await pool.query(
    `
    SELECT id, device_id, topic, payload, received_at, measurement_id
    FROM public.device_logs
    WHERE ($1::text IS NULL OR device_id = $1)
    ORDER BY received_at DESC
    LIMIT $2
    `,
    [deviceId ?? null, limit]
  );
  return res.json(rows.rows);
});

const server = http.createServer(app);
attachWebsocketServer(server);

server.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

