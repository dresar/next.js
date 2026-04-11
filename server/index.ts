import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { z } from "zod";
import http from "node:http";
import { pool } from "./db/pool.js";
import { signAccessToken } from "./auth/jwt.js";
import { requireAuth, requireRole, type AuthedRequest } from "./middleware/auth.js";
import { createMqttClient } from "./iot/mqtt.js";
import { classifyLatexQuality, probeStatusFromDeviceStatus } from "./iot/classify.js";
import { attachWebsocketServer, broadcastJson } from "./realtime/ws.js";
import { createMqttDataHandler } from "./services/mqtt-handler.js";

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

// --- IoT ingest (MQTT) — modular handler with logging ---
const handleMqtt = createMqttDataHandler(broadcastJson);
// (Pemanggilan createMqttClient dipindah ke bawah, khusus untuk lokal berjalan 24 jam)


// ===================== AUTH =====================

app.post("/api/auth/login", async (req, res) => {
  const bodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });

  const { email, password } = body.data;
  const userRes = await pool.query<{ id: string; email: string; password_hash: string; role: string }>(
    `SELECT id, email, password_hash, role FROM public.users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()]
  );
  const user = userRes.rows[0];
  if (!user) return res.status(401).json({ error: "Email atau password salah" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Email atau password salah" });

  const token = signAccessToken({ id: user.id, email: user.email, role: user.role });
  return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

app.post("/api/auth/register", async (req, res) => {
  const bodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, "Password minimal 6 karakter"),
    full_name: z.string().trim().min(1, "Nama wajib diisi").max(200),
    phone: z.string().trim().max(50).optional(),
    address: z.string().trim().max(500).optional(),
  });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) {
    const msg = body.error.errors.map(e => e.message).join(", ");
    return res.status(400).json({ error: msg });
  }

  const { email, password, full_name, phone, address } = body.data;

  // Check if email exists
  const exists = await pool.query(`SELECT id FROM public.users WHERE email = $1`, [email.toLowerCase()]);
  if (exists.rows.length > 0) {
    return res.status(409).json({ error: "Email sudah terdaftar" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const userRes = await pool.query<{ id: string; email: string; role: string }>(
    `INSERT INTO public.users (email, password_hash, role) VALUES ($1, $2, 'petani') RETURNING id, email, role`,
    [email.toLowerCase(), passwordHash]
  );
  const user = userRes.rows[0]!;

  await pool.query(
    `INSERT INTO public.profiles (user_id, full_name, phone, address) VALUES ($1, $2, $3, $4)`,
    [user.id, full_name, phone ?? null, address ?? null]
  );

  // Create welcome notification
  await pool.query(
    `INSERT INTO public.notifications (user_id, title, message, type)
     VALUES ($1, 'Selamat Datang! 🎉', 'Akun petani Anda berhasil dibuat. Hubungi admin untuk mendapatkan akses data pemilik latex.', 'success')`,
    [user.id]
  );

  const token = signAccessToken({ id: user.id, email: user.email, role: user.role });
  return res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });
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
    user: { id: auth.id, email: auth.email, role: auth.role },
    profile: profileRes.rows[0] ?? { full_name: null, phone: null, address: null, avatar_url: null },
  });
});

// ===================== PROFILE =====================

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

// ===================== NOTIFICATIONS =====================

app.get("/api/notifications", requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.auth!;
  const qSchema = z.object({
    limit: z.coerce.number().optional().default(50),
    unread_only: z.string().optional(),
  });
  const q = qSchema.safeParse(req.query);
  const limit = Math.min(q.success ? q.data.limit : 50, 200);
  const unreadOnly = q.success && q.data.unread_only === "true";

  const where = [`user_id = $1`];
  const values: any[] = [auth.id];
  if (unreadOnly) {
    where.push(`is_read = false`);
  }
  values.push(limit);

  const rows = await pool.query(
    `SELECT id, title, message, type, is_read, link, created_at
     FROM public.notifications
     WHERE ${where.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${values.length}`,
    values
  );

  // Also return unread count
  const countRes = await pool.query<{ count: string }>(
    `SELECT count(*)::text as count FROM public.notifications WHERE user_id = $1 AND is_read = false`,
    [auth.id]
  );

  return res.json({
    notifications: rows.rows,
    unread_count: parseInt(countRes.rows[0]?.count ?? "0"),
  });
});

app.patch("/api/notifications/:id/read", requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.auth!;
  await pool.query(
    `UPDATE public.notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
    [req.params.id, auth.id]
  );
  return res.json({ ok: true });
});

app.patch("/api/notifications/read-all", requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.auth!;
  await pool.query(
    `UPDATE public.notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [auth.id]
  );
  return res.json({ ok: true });
});

// ===================== MEASUREMENTS =====================

app.get("/api/measurements", requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.auth!;
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

  // If petani, auto-filter to assigned owners only
  if (auth.role === "petani") {
    const assignedRes = await pool.query<{ owner_name: string }>(
      `SELECT owner_name FROM public.farmer_owners WHERE user_id = $1`,
      [auth.id]
    );
    const assignedOwners = assignedRes.rows.map(r => r.owner_name);
    if (assignedOwners.length === 0) {
      return res.json([]);
    }
    values.push(assignedOwners);
    where.push(`owner_name = ANY($${values.length})`);
  }

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
  const auth = req.auth!;
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

  // If petani, auto-filter
  if (auth.role === "petani") {
    const assignedRes = await pool.query<{ owner_name: string }>(
      `SELECT owner_name FROM public.farmer_owners WHERE user_id = $1`,
      [auth.id]
    );
    const assignedOwners = assignedRes.rows.map(r => r.owner_name);
    if (assignedOwners.length === 0) {
      res.setHeader("content-type", "text/csv; charset=utf-8");
      return res.send("No data");
    }
    values.push(assignedOwners);
    where.push(`owner_name = ANY($${values.length})`);
  }

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

app.post("/api/measurements", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
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

  const row = inserted.rows[0] as any;
  broadcastJson({ type: "measurement:new", data: row });

  // Auto-notify assigned farmers if quality is bad
  if (qualityStatus !== "Mutu Prima") {
    const farmers = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM public.farmer_owners WHERE owner_name = $1`,
      [body.data.ownerName]
    );
    for (const f of farmers.rows) {
      await pool.query(
        `INSERT INTO public.notifications (user_id, title, message, type, link)
         VALUES ($1, $2, $3, $4, '/farmer/data')`,
        [
          f.user_id,
          `⚠️ Peringatan Mutu: ${body.data.ownerName}`,
          `Kualitas lateks ${body.data.ownerName} terdeteksi "${qualityStatus}". pH: ${body.data.ph ?? '-'}, TDS: ${body.data.tds} ppm.`,
          qualityStatus.includes("Prima") ? "success" : "warning",
        ]
      );
      broadcastJson({ type: "notification:new", data: { user_id: f.user_id } });
    }
  }

  return res.json(row);
});

app.patch("/api/measurements/:id", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  const id = req.params.id;
  const bodySchema = z.object({
    owner_name: z.string().trim().min(1).max(200),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });
  await pool.query(
    `
    INSERT INTO public.latex_owners (name)
    VALUES ($1)
    ON CONFLICT (name) DO NOTHING
    `,
    [body.data.owner_name]
  );

  const updated = await pool.query(
    `
    UPDATE public.latex_measurements
    SET owner_name = $1, latitude = $2, longitude = $3
    WHERE id = $4
    RETURNING id, owner_name, ph_value::float8 as ph_value, latitude::float8 as latitude, longitude::float8 as longitude, tds_value, temperature::float8 as temperature, quality_status, device_id, device_status, probe_status, firmware_version, source, created_at
    `,
    [body.data.owner_name, body.data.latitude ?? null, body.data.longitude ?? null, id]
  );
  if (updated.rowCount === 0) return res.status(404).json({ error: "Measurement not found" });
  const row = updated.rows[0] as any;
  broadcastJson({ type: "measurement:updated", data: row });
  return res.json(row);
});

app.delete("/api/measurements/:id", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  const id = req.params.id;
  const deleted = await pool.query(
    `DELETE FROM public.latex_measurements WHERE id = $1 RETURNING id`,
    [id]
  );
  if (deleted.rowCount === 0) return res.status(404).json({ error: "Measurement not found" });
  broadcastJson({ type: "measurement:deleted", data: { id } });
  return res.status(204).send();
});

app.post("/api/measurements/bulk-delete", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  const bodySchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });
  let deleted = 0;
  for (const id of body.data.ids) {
    const r = await pool.query(`DELETE FROM public.latex_measurements WHERE id = $1 RETURNING id`, [id]);
    if (r.rowCount) {
      deleted += 1;
      broadcastJson({ type: "measurement:deleted", data: { id } });
    }
  }
  broadcastJson({ type: "measurements:deleted", data: { deleted } });
  return res.json({ deleted });
});

app.delete("/api/measurements", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  const qSchema = z.object({
    owner: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    quality_status: z.string().optional(),
  });
  const q = qSchema.safeParse(req.query);
  const where: string[] = [];
  const values: unknown[] = [];
  if (q.success) {
    if (q.data.owner) {
      values.push(`%${q.data.owner}%`);
      where.push(`owner_name ILIKE $${values.length}`);
    }
    if (q.data.quality_status) {
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
  }
  const sql = where.length
    ? `DELETE FROM public.latex_measurements WHERE ${where.join(" AND ")}`
    : `DELETE FROM public.latex_measurements`;
  const result = await pool.query(sql, values);
  broadcastJson({ type: "measurements:deleted", data: { deleted: result.rowCount ?? 0 } });
  return res.json({ deleted: result.rowCount ?? 0 });
});

// ===================== DEVICES =====================

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
    LIMIT 1
    `
  );
  return res.json({ offline_after_seconds: env.DEVICE_OFFLINE_SECONDS, devices: rows.rows });
});

// ===================== OWNERS =====================

app.get("/api/owners", requireAuth, async (_req: AuthedRequest, res) => {
  const rows = await pool.query(
    `
    SELECT name
    FROM public.latex_owners
    ORDER BY name ASC
    LIMIT 1000
    `
  );
  return res.json(rows.rows.map((r) => r.name));
});

app.post("/api/owners", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  const bodySchema = z.object({ name: z.string().trim().min(1).max(200) });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });
  const name = body.data.name;
  await pool.query(
    `
    INSERT INTO public.latex_owners (name)
    VALUES ($1)
    ON CONFLICT (name) DO NOTHING
    `,
    [name]
  );
  return res.status(201).json({ name });
});

app.get("/api/owners/:name", requireAuth, async (req: AuthedRequest, res) => {
  const name = String(req.params.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Invalid name" });
  const rows = await pool.query<{ measurement_count: number; last_seen: string | null }>(
    `
    SELECT
      count(*)::int as measurement_count,
      max(created_at)::text as last_seen
    FROM public.latex_measurements
    WHERE owner_name = $1
    `,
    [name]
  );
  return res.json({ name, measurement_count: rows.rows[0]?.measurement_count ?? 0, last_seen: rows.rows[0]?.last_seen ?? null });
});

app.delete("/api/owners/:name", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  const name = String(req.params.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Invalid name" });
  await pool.query(`DELETE FROM public.latex_owners WHERE name = $1`, [name]);
  return res.status(204).send();
});

// ===================== DEVICE LOGS =====================

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

// ===================== ADMIN: USER MANAGEMENT =====================

app.get("/api/admin/users", requireAuth, requireRole("admin"), async (_req: AuthedRequest, res) => {
  const rows = await pool.query(
    `SELECT u.id, u.email, u.role, u.created_at,
            p.full_name, p.phone, p.address
     FROM public.users u
     LEFT JOIN public.profiles p ON p.user_id = u.id
     ORDER BY u.created_at DESC`
  );
  return res.json(rows.rows);
});

app.patch("/api/admin/users/:id/role", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  const bodySchema = z.object({ role: z.enum(["admin", "petani"]) });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Role harus admin atau petani" });

  const id = req.params.id;
  // Prevent self-demotion
  if (id === req.auth!.id && body.data.role !== "admin") {
    return res.status(400).json({ error: "Tidak bisa mengubah role diri sendiri" });
  }

  await pool.query(`UPDATE public.users SET role = $1 WHERE id = $2`, [body.data.role, id]);
  return res.json({ ok: true });
});

app.delete("/api/admin/users/:id", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  const id = req.params.id;
  if (id === req.auth!.id) {
    return res.status(400).json({ error: "Tidak bisa menghapus akun diri sendiri" });
  }
  await pool.query(`DELETE FROM public.users WHERE id = $1`, [id]);
  return res.status(204).send();
});

app.post("/api/admin/users/:id/notify", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  const bodySchema = z.object({
    title: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(1000),
    type: z.enum(["info", "success", "warning", "danger"]).optional().default("info"),
  });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });

  const userId = req.params.id;
  await pool.query(
    `INSERT INTO public.notifications (user_id, title, message, type)
     VALUES ($1, $2, $3, $4)`,
    [userId, body.data.title, body.data.message, body.data.type]
  );
  broadcastJson({ type: "notification:new", data: { user_id: userId } });
  return res.status(201).json({ ok: true });
});

// ===================== ADMIN: FARMER-OWNER ASSIGNMENTS =====================

app.get("/api/admin/farmer-owners", requireAuth, requireRole("admin"), async (_req: AuthedRequest, res) => {
  const rows = await pool.query(
    `SELECT fo.id, fo.user_id, fo.owner_name, fo.created_at,
            u.email, p.full_name
     FROM public.farmer_owners fo
     JOIN public.users u ON u.id = fo.user_id
     LEFT JOIN public.profiles p ON p.user_id = fo.user_id
     ORDER BY fo.created_at DESC`
  );
  return res.json(rows.rows);
});

app.post("/api/admin/farmer-owners", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  const bodySchema = z.object({
    user_id: z.string().uuid(),
    owner_name: z.string().trim().min(1).max(200),
  });
  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid body" });

  try {
    await pool.query(
      `INSERT INTO public.farmer_owners (user_id, owner_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [body.data.user_id, body.data.owner_name]
    );

    // Notify farmer
    await pool.query(
      `INSERT INTO public.notifications (user_id, title, message, type)
       VALUES ($1, '📋 Owner Baru Ditambahkan', $2, 'info')`,
      [body.data.user_id, `Admin telah menambahkan "${body.data.owner_name}" ke daftar pemilik latex Anda.`]
    );
    broadcastJson({ type: "notification:new", data: { user_id: body.data.user_id } });

    return res.status(201).json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: "Gagal menambah assignment" });
  }
});

app.delete("/api/admin/farmer-owners/:id", requireAuth, requireRole("admin"), async (req: AuthedRequest, res) => {
  await pool.query(`DELETE FROM public.farmer_owners WHERE id = $1`, [req.params.id]);
  return res.status(204).send();
});

// ===================== FARMER: MY DATA =====================

app.get("/api/farmer/my-owners", requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.auth!;
  const rows = await pool.query(
    `SELECT fo.id, fo.owner_name, fo.created_at
     FROM public.farmer_owners fo
     WHERE fo.user_id = $1
     ORDER BY fo.owner_name ASC`,
    [auth.id]
  );
  return res.json(rows.rows);
});

app.get("/api/farmer/stats", requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.auth!;

  // Get assigned owners
  const ownersRes = await pool.query<{ owner_name: string }>(
    `SELECT owner_name FROM public.farmer_owners WHERE user_id = $1`,
    [auth.id]
  );
  const ownerNames = ownersRes.rows.map(r => r.owner_name);

  if (ownerNames.length === 0) {
    return res.json({
      total_owners: 0,
      total_measurements: 0,
      avg_ph: null,
      latest_quality: null,
      measurements_this_month: 0,
    });
  }

  const statsRes = await pool.query<{
    total_measurements: string;
    avg_ph: string | null;
    latest_quality: string | null;
    measurements_this_month: string;
  }>(
    `SELECT
      count(*)::text as total_measurements,
      avg(ph_value)::float8::text as avg_ph,
      (SELECT quality_status FROM public.latex_measurements WHERE owner_name = ANY($1) ORDER BY created_at DESC LIMIT 1) as latest_quality,
      (SELECT count(*)::text FROM public.latex_measurements WHERE owner_name = ANY($1) AND created_at >= date_trunc('month', now())) as measurements_this_month
    FROM public.latex_measurements
    WHERE owner_name = ANY($1)`,
    [ownerNames]
  );

  const stats = statsRes.rows[0];
  return res.json({
    total_owners: ownerNames.length,
    total_measurements: parseInt(stats?.total_measurements ?? "0"),
    avg_ph: stats?.avg_ph ? parseFloat(stats.avg_ph) : null,
    latest_quality: stats?.latest_quality ?? null,
    measurements_this_month: parseInt(stats?.measurements_this_month ?? "0"),
  });
});

// ===================== ERROR HANDLER =====================

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express Global Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    detail: err?.message || String(err)
  });
});

const server = http.createServer(app);

// Jika berjalan secara lokal (bukan VERCEL), jalankan websocket & listener
if (!process.env.VERCEL) {
  // Hanya pakai WebSockets dan MQTT Background Worker secara lokal
  attachWebsocketServer(server);
  
  createMqttClient(async ({ topic, payload, receivedAt }) => {
    try {
      await handleMqtt(topic, payload, receivedAt);
    } catch (err) {
      console.error("[mqtt] handler error", err);
    }
  });

  server.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

export default app;
