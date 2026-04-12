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

/**
 * Generate realistic 90-day daily data for a specific owner (Budi Hartono)
 * with natural trends: seasonal drift, random walk, occasional anomalies
 */
async function seedBudiHartonoData(userId: string) {
  const deviceId = "esp32-01";
  const ownerName = "Budi Hartono";
  const now = new Date();
  const DAYS = 90; // 3 bulan ke belakang

  // Starting values
  let ph = 7.8;
  let tds = 420;
  let temp = 29.5;

  for (let day = DAYS; day >= 0; day--) {
    // Date stamp: 'day' hari yang lalu, jam random antara 06:00-18:00
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    date.setHours(6 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);

    // === pH: Random walk with mean reversion toward 7.5-8.5 ===
    const phDrift = (8.0 - ph) * 0.05; // Mean reversion
    const phNoise = (Math.random() - 0.5) * 0.6;
    // Seasonal variation: slightly more acidic during "rainy season" simulation
    const seasonalPh = Math.sin((day / 30) * Math.PI) * 0.3;
    ph = Math.max(4.5, Math.min(11.0, ph + phDrift + phNoise + seasonalPh * 0.05));
    ph = Number(ph.toFixed(2));

    // === TDS: random walk around 350-600 range ===
    const tdsDrift = (480 - tds) * 0.03;
    const tdsNoise = (Math.random() - 0.5) * 60;
    tds = Math.max(100, Math.min(1200, tds + tdsDrift + tdsNoise));
    tds = Math.round(tds);

    // === Temperature: follows a gentle cycle (warmer midday etc.) ===
    const tempDrift = (30 - temp) * 0.1;
    const tempNoise = (Math.random() - 0.5) * 2;
    // Slight seasonal variation
    const seasonalTemp = Math.cos((day / 45) * Math.PI) * 1.5;
    temp = Math.max(24, Math.min(38, temp + tempDrift + tempNoise + seasonalTemp * 0.03));
    temp = Number(temp.toFixed(1));

    // === Occasional anomalies (every ~15 days) ===
    if (day % 15 === 7 && Math.random() > 0.3) {
      // Spike: bad day — low pH or high TDS
      if (Math.random() > 0.5) {
        ph = Number((5.0 + Math.random() * 1.5).toFixed(2)); // Acidic spike
      } else {
        tds = Math.round(700 + Math.random() * 400); // Contamination spike
      }
    }

    const qualityStatus = classifyLatex(ph, tds);
    const latitude = Number((-2.5 + Math.random() * 0.01).toFixed(6));
    const longitude = Number((104.7 + Math.random() * 0.01).toFixed(6));
    const voltage = Number(randomBetween(1.5, 3.3).toFixed(3));
    const battery = Number(randomBetween(30, 95).toFixed(1));
    const probeStatus = "liquid_detected";

    await pool.query(
      `
      INSERT INTO public.latex_measurements
        (user_id, owner_name, ph_value, tds_value, temperature, quality_status, latitude, longitude,
         device_id, voltage_probe, battery_level, device_status, probe_status, firmware_version, source, created_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, 'ok', $12, 'v1.2.0', 'mqtt', $13)
      `,
      [userId, ownerName, ph, tds, temp, qualityStatus, latitude, longitude, deviceId, voltage, battery, probeStatus, date.toISOString()]
    );

    // Some days have 2-3 measurements (morning/afternoon)
    if (Math.random() > 0.6) {
      const date2 = new Date(date);
      date2.setHours(date2.getHours() + 4 + Math.floor(Math.random() * 4));
      const ph2 = Number((ph + (Math.random() - 0.5) * 0.4).toFixed(2));
      const tds2 = Math.round(tds + (Math.random() - 0.5) * 30);
      const temp2 = Number((temp + (Math.random() - 0.5) * 1.5).toFixed(1));
      const qs2 = classifyLatex(ph2, tds2);
      await pool.query(
        `
        INSERT INTO public.latex_measurements
          (user_id, owner_name, ph_value, tds_value, temperature, quality_status, latitude, longitude,
           device_id, voltage_probe, battery_level, device_status, probe_status, firmware_version, source, created_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11, 'ok', $12, 'v1.2.0', 'mqtt', $13)
        `,
        [userId, ownerName, ph2, tds2, temp2, qs2, latitude, longitude, deviceId, voltage, battery, probeStatus, date2.toISOString()]
      );
    }
  }
}

/**
 * Seed a few measurements for other owners (not Budi Hartono) — just a few random ones
 */
async function seedOtherOwnerData(userIds: string[]) {
  const deviceIds = ["esp32-01", "esp32-02"];
  const otherOwners = owners.filter(o => o !== "Budi Hartono");

  for (let i = 0; i < otherOwners.length; i++) {
    const ownerName = otherOwners[i]!;
    // Each other owner gets 3-8 measurements spread over last 30 days
    const count = 3 + Math.floor(Math.random() * 6);
    for (let j = 0; j < count; j++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      date.setHours(6 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);

      const ph = Number(randomBetween(5, 10).toFixed(1));
      const tds = Math.round(randomBetween(150, 900));
      const temperature = Number(randomBetween(26, 34).toFixed(1));
      const qualityStatus = classifyLatex(ph, tds);
      const latitude = Number((-(1.5 + Math.random() * 5)).toFixed(6));
      const longitude = Number((103 + Math.random() * 10).toFixed(6));
      const userId = userIds[Math.floor(Math.random() * userIds.length)]!;
      const deviceId = deviceIds[i % deviceIds.length]!;
      const voltage = Number(randomBetween(0.8, 3.3).toFixed(3));
      const battery = Number(randomBetween(15, 95).toFixed(1));
      const probeStatus = "liquid_detected";

      await pool.query(
        `
        INSERT INTO public.latex_measurements
          (user_id, owner_name, ph_value, tds_value, temperature, quality_status, latitude, longitude,
           device_id, voltage_probe, battery_level, device_status, probe_status, firmware_version, source, created_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11, 'ok', $12, 'v1.2.0', 'manual', $13)
        `,
        [userId, ownerName, ph, tds, temperature, qualityStatus, latitude, longitude, deviceId, voltage, battery, probeStatus, date.toISOString()]
      );
    }
  }
}

async function seedMeasurements(userIds: string[], petani1Id: string) {
  // Bersihkan data lama
  await pool.query("TRUNCATE TABLE public.device_logs, public.latex_measurements, public.devices RESTART IDENTITY");

  // Seed devices
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

  // 1) Data Budi Hartono — 90 hari, setiap hari ada data (khusus demo petani)
  console.log("  Seeding 90 days of Budi Hartono data...");
  await seedBudiHartonoData(petani1Id);

  // 2) Data owner lain (beberapa random saja)
  console.log("  Seeding other owner data...");
  await seedOtherOwnerData(userIds);
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

  // -- Seed latex_owners registry (untuk halaman /owners admin) --
  await pool.query(`DELETE FROM public.latex_owners`);
  console.log("  Seeding latex_owners registry...");
  for (const name of owners) {
    await pool.query(
      `INSERT INTO public.latex_owners (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [name]
    );
  }

  // -- Assign owners to petani (1 petani = 1 pemilik, yaitu diri sendiri) --
  // Clear existing assignments
  await pool.query(`DELETE FROM public.farmer_owners`);

  // Petani 1: Budi Hartono (owners[1])
  await pool.query(
    `INSERT INTO public.farmer_owners (user_id, owner_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [petani1.id, "Budi Hartono"]
  );

  // Petani 2: Citra Dewi (owners[2])
  await pool.query(
    `INSERT INTO public.farmer_owners (user_id, owner_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [petani2.id, "Citra Dewi"]
  );

  // Petani 3: Darmawan (owners[3])
  await pool.query(
    `INSERT INTO public.farmer_owners (user_id, owner_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [petani3.id, "Darmawan"]
  );

  // -- Seed notifications --
  await pool.query(`DELETE FROM public.notifications`);

  const notifs = [
    { userId: petani1.id, title: "Selamat Datang! 🎉", message: "Akun petani Anda berhasil dibuat oleh admin.", type: "success" },
    { userId: petani1.id, title: "⚠️ Peringatan Mutu", message: "Kualitas lateks terdeteksi \"Mutu Rendah Asam\". pH: 5.2, TDS: 450 ppm.", type: "warning" },
    { userId: petani1.id, title: "📊 Data Baru Masuk", message: "Pengukuran baru untuk Budi Hartono telah dicatat oleh sistem.", type: "info" },
    { userId: petani2.id, title: "Selamat Datang! 🎉", message: "Akun petani Anda berhasil dibuat oleh admin.", type: "success" },
    { userId: petani2.id, title: "📊 Data Baru Masuk", message: "Pengukuran baru untuk Citra Dewi telah dicatat oleh sistem.", type: "info" },
    { userId: petani3.id, title: "Selamat Datang! 🎉", message: "Akun petani Anda berhasil dibuat oleh admin.", type: "success" },
  ];

  for (const n of notifs) {
    await pool.query(
      `INSERT INTO public.notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
      [n.userId, n.title, n.message, n.type]
    );
  }

  await seedMeasurements(users.map((u) => u.id), petani1.id);

  const counts = await pool.query<{
    users: string;
    profiles: string;
    measurements: string;
    notifications: string;
    farmer_owners: string;
    latex_owners: string;
  }>(
    `
    SELECT
      (SELECT count(*)::text FROM public.users) as users,
      (SELECT count(*)::text FROM public.profiles) as profiles,
      (SELECT count(*)::text FROM public.latex_measurements) as measurements,
      (SELECT count(*)::text FROM public.notifications) as notifications,
      (SELECT count(*)::text FROM public.farmer_owners) as farmer_owners,
      (SELECT count(*)::text FROM public.latex_owners) as latex_owners
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
