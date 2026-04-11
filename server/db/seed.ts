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

async function upsertUser(params: { email: string; password: string; role: string }) {
  const passwordHash = await bcrypt.hash(params.password, 10);
  const res = await pool.query<{ id: string; email: string; role: string }>(
    `
    INSERT INTO public.users (email, password_hash, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
    RETURNING id, email, role
    `,
    [params.email, passwordHash, params.role]
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
  const users: { id: string; email: string; role: string }[] = [];

  // Admin accounts
  users.push(await upsertUser({ email: "demo@latexguard.local", password: "demo12345", role: "admin" }));

  // Petani demo accounts
  const petani1 = await upsertUser({ email: "petani1@latexguard.local", password: "petani123", role: "petani" });
  const petani2 = await upsertUser({ email: "petani2@latexguard.local", password: "petani123", role: "petani" });
  const petani3 = await upsertUser({ email: "petani3@latexguard.local", password: "petani123", role: "petani" });
  users.push(petani1, petani2, petani3);

  // Additional admin users
  for (let i = 1; i < 17; i++) {
    const n = String(i).padStart(2, "0");
    users.push(await upsertUser({ email: `user${n}@latexguard.local`, password: "password123", role: "admin" }));
  }

  // Profiles
  for (let i = 0; i < users.length; i++) {
    const u = users[i]!;
    await upsertProfile({
      userId: u.id,
      fullName: owners[i % owners.length]!,
      phone: `08${Math.floor(1000000000 + Math.random() * 8999999999)}`,
      address: `Alamat Dummy ${i + 1}`,
    });
  }

  // -- Assign owners to petani --
  // Clear existing assignments
  await pool.query(`DELETE FROM public.farmer_owners`);

  // Petani 1: Ahmad Sutisna, Budi Hartono, Citra Dewi, Darmawan, Eka Prasetya
  for (const name of owners.slice(0, 5)) {
    await pool.query(
      `INSERT INTO public.farmer_owners (user_id, owner_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [petani1.id, name]
    );
  }

  // Petani 2: Fitri Handayani, Galih Wicaksono, Hana Putri, Indra Wijaya, Joko Santoso
  for (const name of owners.slice(5, 10)) {
    await pool.query(
      `INSERT INTO public.farmer_owners (user_id, owner_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [petani2.id, name]
    );
  }

  // Petani 3: Kartika Sari, Lukman Hakim, Maya Lestari, Nanda Pratama, Oki Ramadhan
  for (const name of owners.slice(10, 15)) {
    await pool.query(
      `INSERT INTO public.farmer_owners (user_id, owner_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [petani3.id, name]
    );
  }

  // -- Seed notifications --
  await pool.query(`DELETE FROM public.notifications`);

  const notifs = [
    { userId: petani1.id, title: "Selamat Datang! 🎉", message: "Akun petani Anda berhasil dibuat. Anda memiliki 5 pemilik latex yang di-assign.", type: "success" },
    { userId: petani1.id, title: "⚠️ Peringatan Mutu: Ahmad Sutisna", message: "Kualitas lateks terdeteksi \"Mutu Rendah Asam\". pH: 5.2, TDS: 450 ppm.", type: "warning" },
    { userId: petani1.id, title: "📊 Data Baru Masuk", message: "Pengukuran baru untuk Budi Hartono telah dicatat oleh sistem.", type: "info" },
    { userId: petani2.id, title: "Selamat Datang! 🎉", message: "Akun petani Anda berhasil dibuat. Anda memiliki 5 pemilik latex yang di-assign.", type: "success" },
    { userId: petani2.id, title: "📋 Owner Baru Ditambahkan", message: "Admin telah menambahkan \"Joko Santoso\" ke daftar pemilik latex Anda.", type: "info" },
    { userId: petani3.id, title: "Selamat Datang! 🎉", message: "Akun petani Anda berhasil dibuat. Anda memiliki 5 pemilik latex yang di-assign.", type: "success" },
  ];

  for (const n of notifs) {
    await pool.query(
      `INSERT INTO public.notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
      [n.userId, n.title, n.message, n.type]
    );
  }

  await seedMeasurements(users.map((u) => u.id));

  const counts = await pool.query<{
    users: string;
    profiles: string;
    measurements: string;
    notifications: string;
    farmer_owners: string;
  }>(
    `
    SELECT
      (SELECT count(*)::text FROM public.users) as users,
      (SELECT count(*)::text FROM public.profiles) as profiles,
      (SELECT count(*)::text FROM public.latex_measurements) as measurements,
      (SELECT count(*)::text FROM public.notifications) as notifications,
      (SELECT count(*)::text FROM public.farmer_owners) as farmer_owners
    `
  );

  console.log("Seed done.");
  console.log("Admin login: demo@latexguard.local / demo12345");
  console.log("Petani login: petani1@latexguard.local / petani123");
  console.log("            : petani2@latexguard.local / petani123");
  console.log("            : petani3@latexguard.local / petani123");
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
