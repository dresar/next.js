import bcrypt from "bcryptjs";
import { pool } from "./pool";

type LatexStatus =
  | "Mutu Prima"
  | "Mutu Rendah Asam"
  | "Terawetkan Amonia"
  | "Indikasi Oplos Air"
  | "Indikasi Kontaminasi";

function classifyLatex(ph: number, tds: number): LatexStatus {
  if (ph <= 6) return "Mutu Rendah Asam";
  if (ph >= 9) return "Terawetkan Amonia";
  if (tds <= 300) return "Indikasi Oplos Air";
  if (tds >= 800) return "Indikasi Kontaminasi";
  return "Mutu Prima";
}

const owners = [
  "Ahmad Sutisna",
  "Budi Hartono",
  "Citra Dewi",
  "Darmawan",
  "Eka Prasetya",
  "Fitri Handayani",
  "Galih Wicaksono",
  "Hana Putri",
  "Indra Wijaya",
  "Joko Santoso",
  "Kartika Sari",
  "Lukman Hakim",
  "Maya Lestari",
  "Nanda Pratama",
  "Oki Ramadhan",
  "Putri Ayu",
  "Rudi Kurniawan",
  "Siti Nurhaliza",
  "Tono Saputra",
  "Vina Maharani",
];

async function upsertUser(params: { email: string; password: string }) {
  const passwordHash = await bcrypt.hash(params.password, 10);
  const res = await pool.query<{ id: string; email: string }>(
    `
    INSERT INTO public.users (email, password_hash)
    VALUES ($1, $2)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING id, email
    `,
    [params.email, passwordHash]
  );
  return res.rows[0]!;
}

async function upsertProfile(params: { userId: string; fullName: string; phone?: string; address?: string }) {
  await pool.query(
    `
    INSERT INTO public.profiles (user_id, full_name, phone, address)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address
    `,
    [params.userId, params.fullName, params.phone ?? null, params.address ?? null]
  );
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

async function seedMeasurements(userIds: string[]) {
  // Keep it idempotent-ish: wipe and reinsert for consistent 20 rows
  await pool.query("TRUNCATE TABLE public.device_logs, public.latex_measurements, public.devices RESTART IDENTITY");

  const deviceIds = ["esp32-01", "esp32-02"];
  await pool.query(
    `
    INSERT INTO public.devices (id, wifi_connected, mqtt_connected, battery_level, firmware_version, last_seen, last_data_at, last_status_at, last_status)
    VALUES
      ($1, true, true, 78.5, 'v1.2.0', now(), now(), now(), 'ok'),
      ($2, true, true, 41.2, 'v1.2.0', now(), now(), now(), 'ok')
    ON CONFLICT (id) DO NOTHING
    `,
    deviceIds
  );

  for (let i = 0; i < 20; i++) {
    const ph = Number(randomBetween(4, 10).toFixed(1));
    const tds = Math.round(randomBetween(100, 1100));
    const temperature = Number(randomBetween(25, 35).toFixed(1));
    const qualityStatus = classifyLatex(ph, tds);
    const latitude = Number((-(1.5 + Math.random() * 5)).toFixed(6));
    const longitude = Number((103 + Math.random() * 10).toFixed(6));
    const ownerName = owners[i % owners.length]!;
    const userId = userIds[Math.floor(Math.random() * userIds.length)]!;
    const deviceId = deviceIds[i % deviceIds.length]!;
    const voltage = Number(randomBetween(0.8, 3.3).toFixed(3));
    const battery = Number(randomBetween(15, 95).toFixed(1));
    const deviceStatus = i % 11 === 0 ? "probe_dry" : "ok";
    const probeStatus = deviceStatus === "probe_dry" ? "probe_dry" : "liquid_detected";

    await pool.query(
      `
      INSERT INTO public.latex_measurements
        (user_id, owner_name, ph_value, tds_value, temperature, quality_status, latitude, longitude,
         device_id, voltage_probe, battery_level, device_status, probe_status, firmware_version, source)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, 'v1.2.0', 'manual')
      `,
      [userId, ownerName, ph, tds, temperature, qualityStatus, latitude, longitude, deviceId, voltage, battery, deviceStatus, probeStatus]
    );
  }
}

async function main() {
  const users: { id: string; email: string }[] = [];

  // 1 demo user + 19 additional users (20 total)
  users.push(await upsertUser({ email: "demo@latexguard.local", password: "demo12345" }));
  for (let i = 1; i < 20; i++) {
    const n = String(i).padStart(2, "0");
    users.push(await upsertUser({ email: `user${n}@latexguard.local`, password: "password123" }));
  }

  for (let i = 0; i < users.length; i++) {
    const u = users[i]!;
    await upsertProfile({
      userId: u.id,
      fullName: owners[i % owners.length]!,
      phone: `08${Math.floor(1000000000 + Math.random() * 8999999999)}`,
      address: `Alamat Dummy ${i + 1}`,
    });
  }

  await seedMeasurements(users.map((u) => u.id));

  const counts = await pool.query<{
    users: string;
    profiles: string;
    measurements: string;
  }>(
    `
    SELECT
      (SELECT count(*)::text FROM public.users) as users,
      (SELECT count(*)::text FROM public.profiles) as profiles,
      (SELECT count(*)::text FROM public.latex_measurements) as measurements
    `
  );

  console.log("Seed done.");
  console.log("Demo login:", "demo@latexguard.local / demo12345");
  console.log("Counts:", counts.rows[0]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

