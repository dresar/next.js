import { DashboardLayout } from "@/components/DashboardLayout";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Database,
  GitBranch,
  Cpu,
  Shield,
  Layers,
  BarChart3,
  Globe,
  ChevronDown,
  ChevronRight,
  Server,
  Wifi,
  Code2,
} from "lucide-react";

/* ─── Mermaid Chart Definitions ─── */

const erdChart = `erDiagram
    users {
        UUID id PK
        TEXT email UK
        TEXT password_hash
        TEXT role
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    profiles {
        UUID id PK
        UUID user_id FK
        TEXT full_name
        TEXT avatar_url
        TEXT phone
        TEXT address
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    latex_measurements {
        UUID id PK
        UUID user_id FK
        TEXT owner_name
        NUMERIC ph_value
        INTEGER tds_value
        NUMERIC temperature
        TEXT quality_status
        TEXT device_id
        NUMERIC voltage_probe
        NUMERIC battery_level
        TEXT device_status
        TEXT probe_status
        TEXT firmware_version
        TEXT source
        NUMERIC latitude
        NUMERIC longitude
        TIMESTAMPTZ created_at
    }
    latex_owners {
        UUID id PK
        TEXT name UK
        TIMESTAMPTZ created_at
    }
    farmer_owners {
        UUID id PK
        UUID user_id FK
        TEXT owner_name
        TIMESTAMPTZ created_at
    }
    notifications {
        UUID id PK
        UUID user_id FK
        TEXT title
        TEXT message
        TEXT type
        BOOLEAN is_read
        TEXT link
        TIMESTAMPTZ created_at
    }
    devices {
        TEXT id PK
        BOOLEAN wifi_connected
        BOOLEAN mqtt_connected
        NUMERIC battery_level
        TEXT firmware_version
        TIMESTAMPTZ last_seen
        TIMESTAMPTZ last_data_at
        TIMESTAMPTZ last_status_at
        TEXT last_status
    }
    device_logs {
        BIGSERIAL id PK
        TEXT device_id FK
        TEXT topic
        JSONB payload
        TIMESTAMPTZ received_at
        UUID measurement_id FK
    }

    users ||--o| profiles : "has"
    users ||--o{ latex_measurements : "records"
    users ||--o{ farmer_owners : "assigned"
    users ||--o{ notifications : "receives"
    latex_measurements }o--|| devices : "from"
    device_logs }o--|| devices : "logs"
    device_logs }o--o| latex_measurements : "references"
`;

const systemArchChart = `flowchart TB
    subgraph ESP["🔧 ESP32 Microcontroller"]
        SENSOR["Sensor pH & TDS"]
        TEMP["Sensor Suhu DS18B20"]
        MCU["ESP32 MCU"]
    end

    subgraph CLOUD["☁️ Cloud Services"]
        MQTT["HiveMQ MQTT Broker"]
        NEON["Neon PostgreSQL"]
    end

    subgraph BACKEND["⚙️ Backend Server"]
        EXPRESS["Express.js API"]
        MQTTSUB["MQTT Subscriber"]
        WS["WebSocket Server"]
        AUTH["JWT Auth Middleware"]
        CLASSIFY["Quality Classifier"]
    end

    subgraph FRONTEND["🖥️ Frontend React"]
        ADMIN["Admin Dashboard"]
        FARMER["Farmer Dashboard"]
        REALTIME["Realtime Updates"]
    end

    SENSOR --> MCU
    TEMP --> MCU
    MCU -- "publish JSON" --> MQTT
    MQTT -- "subscribe" --> MQTTSUB
    MQTTSUB -- "process & save" --> EXPRESS
    EXPRESS -- "query/insert" --> NEON
    EXPRESS --> AUTH
    EXPRESS --> CLASSIFY
    EXPRESS -- "broadcast" --> WS
    WS -- "push events" --> REALTIME
    REALTIME --> ADMIN
    REALTIME --> FARMER
    ADMIN -- "REST API" --> EXPRESS
    FARMER -- "REST API" --> EXPRESS
`;

const mqttFlowChart = `sequenceDiagram
    participant ESP as ESP32
    participant MQTT as HiveMQ Broker
    participant SRV as Server (Express)
    participant DB as PostgreSQL
    participant WS as WebSocket
    participant UI as Browser

    ESP->>MQTT: Publish JSON (pH, TDS, Suhu)
    Note over ESP,MQTT: Topic: skripsi/eka/lateks

    MQTT->>SRV: Deliver Message
    SRV->>SRV: Parse & Validate Payload
    SRV->>SRV: Classify Quality (pH + TDS)
    SRV->>DB: INSERT latex_measurements
    SRV->>DB: UPSERT devices (status)
    SRV->>DB: INSERT device_logs
    SRV->>WS: Broadcast measurement:new

    alt Quality != Mutu Prima
        SRV->>DB: INSERT notification (warning)
        SRV->>WS: Broadcast notification:new
    end

    WS->>UI: Push realtime event
    UI->>UI: Update Dashboard & Charts
`;

const authFlowChart = `flowchart LR
    subgraph LOGIN["Login Flow"]
        A["User Input Email + Password"] --> B["POST /api/auth/login"]
        B --> C{"Validate Credentials"}
        C -- "Valid" --> D["Generate JWT Token"]
        C -- "Invalid" --> E["401 Error"]
        D --> F{"Check Role"}
        F -- "admin" --> G["Redirect /admin"]
        F -- "petani" --> H["Prefetch All Data"]
        H --> I["Redirect /farmer"]
    end
`;

const qualityFlowChart = `flowchart TD
    START["📊 Data Masuk: pH + TDS"] --> CHECK_TDS{"TDS <= 200?"}
    CHECK_TDS -- "Ya" --> NO_SAMPLE["❌ Tidak Ada Sampel"]
    CHECK_TDS -- "Tidak" --> CHECK_PH{"Cek pH"}

    CHECK_PH -- "pH <= 7.5" --> ASAM["🟡 Mutu Rendah Asam"]
    CHECK_PH -- "pH >= 8.8" --> AMONIA["🟠 Terawetkan Amonia"]
    CHECK_PH -- "7.6 - 8.7" --> CHECK_TDS2{"Cek TDS"}

    CHECK_TDS2 -- "TDS <= 500" --> PRIMA["🟢 Mutu Prima"]
    CHECK_TDS2 -- "501-1100" --> KONTAMINASI["🔴 Indikasi Kontaminasi"]
    CHECK_TDS2 -- "TDS > 1100" --> OPLOS["🔴 Indikasi Oplos Air"]

    style PRIMA fill:#065f46,stroke:#10b981,color:#fff
    style ASAM fill:#78350f,stroke:#f59e0b,color:#fff
    style AMONIA fill:#78350f,stroke:#f97316,color:#fff
    style KONTAMINASI fill:#7f1d1d,stroke:#ef4444,color:#fff
    style OPLOS fill:#7f1d1d,stroke:#ef4444,color:#fff
    style NO_SAMPLE fill:#1e293b,stroke:#64748b,color:#94a3b8
`;

const deploymentChart = `flowchart TB
    subgraph CLIENT["Client Side"]
        BROWSER["🌐 Browser"]
        VITE["Vite Dev Server :8080"]
    end

    subgraph SERVER["Server Side"]
        API["Express API :3001"]
        TSX["tsx watch (hot reload)"]
    end

    subgraph EXTERNAL["External Services"]
        HIVEMQ["HiveMQ Cloud MQTT"]
        NEONDB["Neon PostgreSQL"]
        VERCEL["Vercel (Production)"]
    end

    BROWSER -- "proxy /api/*" --> VITE
    VITE -- "forward" --> API
    TSX --> API
    API -- "MQTT subscribe" --> HIVEMQ
    API -- "SQL queries" --> NEONDB
    API -- "Serverless deploy" --> VERCEL
`;

/* ─── Section Data ─── */
type SectionId =
  | "overview"
  | "erd"
  | "system"
  | "mqtt"
  | "auth"
  | "quality"
  | "api"
  | "deployment"
  | "tech";

interface Section {
  id: SectionId;
  title: string;
  icon: typeof BookOpen;
  color: string;
}

const sections: Section[] = [
  { id: "overview", title: "Ringkasan Sistem", icon: BookOpen, color: "text-blue-400" },
  { id: "erd", title: "Entity Relationship Diagram", icon: Database, color: "text-emerald-400" },
  { id: "system", title: "Arsitektur Sistem", icon: Layers, color: "text-purple-400" },
  { id: "mqtt", title: "Alur Data MQTT/IoT", icon: Wifi, color: "text-orange-400" },
  { id: "auth", title: "Autentikasi & Otorisasi", icon: Shield, color: "text-yellow-400" },
  { id: "quality", title: "Algoritma Klasifikasi Mutu", icon: BarChart3, color: "text-cyan-400" },
  { id: "api", title: "API Endpoints Reference", icon: Globe, color: "text-pink-400" },
  { id: "deployment", title: "Deployment & Infrastruktur", icon: Server, color: "text-indigo-400" },
  { id: "tech", title: "Technology Stack", icon: Code2, color: "text-green-400" },
];

/* ─── Components ─── */

function SectionCard({
  title,
  icon: Icon,
  color,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: typeof BookOpen;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 sm:p-5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className={`h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="flex-1 text-sm sm:text-base font-bold text-foreground">{title}</h2>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-5 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function InfoTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="bg-muted/30 border-b">
            {headers.map((h) => (
              <th key={h} className="p-2 sm:p-3 text-left font-semibold text-muted-foreground whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/30 hover:bg-muted/10">
              {row.map((cell, j) => (
                <td key={j} className="p-2 sm:p-3 whitespace-nowrap">
                  <span className={j === 0 ? "font-mono text-primary" : ""}>{cell}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ children, variant = "default" }: { children: string; variant?: "default" | "green" | "blue" | "orange" | "red" }) {
  const colors = {
    default: "bg-muted text-muted-foreground",
    green: "bg-green-500/10 text-green-400",
    blue: "bg-blue-500/10 text-blue-400",
    orange: "bg-orange-500/10 text-orange-400",
    red: "bg-red-500/10 text-red-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[variant]}`}>
      {children}
    </span>
  );
}

/* ─── Main Page ─── */

export default function DocumentationPage() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">Dokumentasi Sistem</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">LatexGuard — IoT Monitoring Kualitas Lateks</p>
          </div>
        </div>

        {/* Table of Contents */}
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            Daftar Isi
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
              >
                <span className="text-primary font-mono text-[10px]">{String(i + 1).padStart(2, "0")}</span>
                <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                <span>{s.title}</span>
              </a>
            ))}
          </div>
        </div>

        {/* 1. Overview */}
        <div id="overview">
          <SectionCard title="Ringkasan Sistem" icon={BookOpen} color="text-blue-400" defaultOpen>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground">LatexGuard</strong> adalah sistem monitoring kualitas lateks berbasis IoT
                yang menggunakan mikrokontroller <strong>ESP32</strong> untuk membaca sensor pH, TDS (Total Dissolved Solids),
                dan suhu secara realtime. Data dikirim melalui protokol <strong>MQTT</strong> ke server, diproses, dan ditampilkan
                di dashboard web yang interaktif.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <p className="text-xs font-semibold text-blue-400 mb-1">🎯 Tujuan</p>
                  <p className="text-[11px]">Monitoring kualitas lateks secara otomatis dan realtime untuk mengoptimalkan proses produksi karet.</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <p className="text-xs font-semibold text-green-400 mb-1">👥 Pengguna</p>
                  <p className="text-[11px]">Admin panel untuk manajemen data & device. Dashboard petani untuk monitoring hasil pengukuran.</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                  <p className="text-xs font-semibold text-purple-400 mb-1">⚡ Fitur Utama</p>
                  <p className="text-[11px]">Realtime data via MQTT + WebSocket, klasifikasi mutu otomatis, notif peringatan, trading chart.</p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* 2. ERD */}
        <div id="erd">
          <SectionCard title="Entity Relationship Diagram (ERD)" icon={Database} color="text-emerald-400" defaultOpen>
            <p className="text-xs text-muted-foreground mb-3">
              Diagram berikut menampilkan seluruh tabel dalam database PostgreSQL (Neon) beserta relasi antar entitas.
            </p>
            <div className="rounded-lg border bg-background/50 p-4 overflow-x-auto">
              <MermaidDiagram chart={erdChart} id="erd" />
            </div>
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-foreground mb-2">📋 Deskripsi Tabel:</h4>
              <InfoTable
                headers={["Tabel", "Deskripsi", "Relasi"]}
                rows={[
                  ["users", "Akun pengguna (admin & petani)", "PK: id, UK: email"],
                  ["profiles", "Data profil lengkap user", "FK: user_id → users.id"],
                  ["latex_measurements", "Data pengukuran lateks dari sensor", "FK: user_id → users.id"],
                  ["latex_owners", "Registry nama pemilik lateks", "UK: name"],
                  ["farmer_owners", "Mapping 1:1 petani → pemilik", "FK: user_id → users.id"],
                  ["notifications", "Notifikasi untuk user", "FK: user_id → users.id"],
                  ["devices", "Status perangkat ESP32", "PK: id (device_id)"],
                  ["device_logs", "Log raw MQTT payload", "FK: device_id → devices.id"],
                ]}
              />
            </div>
          </SectionCard>
        </div>

        {/* 3. System Architecture */}
        <div id="system">
          <SectionCard title="Arsitektur Sistem" icon={Layers} color="text-purple-400" defaultOpen>
            <p className="text-xs text-muted-foreground mb-3">
              Arsitektur end-to-end dari sensor hardware ESP32 hingga frontend dashboard.
            </p>
            <div className="rounded-lg border bg-background/50 p-4 overflow-x-auto">
              <MermaidDiagram chart={systemArchChart} id="system-arch" />
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-muted/10">
                <h4 className="text-xs font-semibold text-foreground mb-2">🔧 Hardware Layer</h4>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  <li>• ESP32 sebagai mikrokontroller utama</li>
                  <li>• Sensor pH (analog → voltage → pH)</li>
                  <li>• Sensor TDS (resistif → ppm)</li>
                  <li>• Sensor Suhu DS18B20 (digital, 1-Wire)</li>
                  <li>• WiFi built-in untuk koneksi MQTT</li>
                </ul>
              </div>
              <div className="p-3 rounded-lg border bg-muted/10">
                <h4 className="text-xs font-semibold text-foreground mb-2">☁️ Cloud / Backend Layer</h4>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  <li>• HiveMQ sebagai MQTT Broker (public)</li>
                  <li>• Express.js sebagai REST API server</li>
                  <li>• WebSocket untuk realtime push</li>
                  <li>• Neon PostgreSQL sebagai database</li>
                  <li>• JWT untuk autentikasi stateless</li>
                </ul>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* 4. MQTT Flow */}
        <div id="mqtt">
          <SectionCard title="Alur Data MQTT / IoT" icon={Wifi} color="text-orange-400">
            <p className="text-xs text-muted-foreground mb-3">
              Sequence diagram alur data dari ESP32 → MQTT Broker → Server → Database → WebSocket → Browser.
            </p>
            <div className="rounded-lg border bg-background/50 p-4 overflow-x-auto">
              <MermaidDiagram chart={mqttFlowChart} id="mqtt-flow" />
            </div>
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-foreground mb-2">📡 MQTT Topics:</h4>
              <InfoTable
                headers={["Topic", "Subscriber", "Deskripsi"]}
                rows={[
                  ["skripsi/eka/lateks", "Server", "Data utama sensor (pH, TDS, suhu, device info)"],
                  ["latex/iot/data", "Server", "Topik alternatif untuk data sensor"],
                  ["latex/iot/status", "Server", "Status device (battery, firmware, wifi)"],
                ]}
              />
            </div>
            <div className="mt-3">
              <h4 className="text-xs font-semibold text-foreground mb-2">📦 Contoh Payload MQTT (JSON):</h4>
              <pre className="p-3 rounded-lg bg-muted/30 text-[11px] font-mono text-muted-foreground overflow-x-auto">
{`{
  "ph": 7.80,
  "tds": 632,
  "suhu": 29.9,
  "deviceId": "esp32-01",
  "voltage": 2.45,
  "battery": 78.5,
  "firmwareVersion": "v1.2.0",
  "wifiConnected": true,
  "mqttConnected": true
}`}
              </pre>
            </div>
          </SectionCard>
        </div>

        {/* 5. Auth Flow */}
        <div id="auth">
          <SectionCard title="Autentikasi & Otorisasi" icon={Shield} color="text-yellow-400">
            <p className="text-xs text-muted-foreground mb-3">
              Sistem menggunakan JWT (JSON Web Token) untuk autentikasi dan role-based access control (RBAC).
            </p>
            <div className="rounded-lg border bg-background/50 p-4 overflow-x-auto">
              <MermaidDiagram chart={authFlowChart} id="auth-flow" />
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-muted/10">
                <h4 className="text-xs font-semibold text-foreground mb-1">👨‍💼 Admin</h4>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  <li>• Dashboard monitoring utama</li>
                  <li>• CRUD pengukuran lateks</li>
                  <li>• Kelola pemilik latex</li>
                  <li>• Kelola user & role</li>
                  <li>• Kirim notifikasi ke petani</li>
                  <li>• Device monitoring & logs</li>
                </ul>
              </div>
              <div className="p-3 rounded-lg border bg-muted/10">
                <h4 className="text-xs font-semibold text-foreground mb-1">🧑‍🌾 Petani</h4>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  <li>• Dashboard data milik sendiri</li>
                  <li>• Trading chart (pH, TDS, Suhu)</li>
                  <li>• Riwayat pengukuran</li>
                  <li>• Terima notifikasi peringatan mutu</li>
                  <li>• Edit profil (nama auto sync)</li>
                  <li>• Zero loading (prefetch saat login)</li>
                </ul>
              </div>
            </div>
            <div className="mt-3">
              <h4 className="text-xs font-semibold text-foreground mb-2">🔑 JWT Payload:</h4>
              <pre className="p-3 rounded-lg bg-muted/30 text-[11px] font-mono text-muted-foreground">
{`{
  "sub": "uuid-user-id",
  "email": "demo@latexguard.local",
  "role": "admin",
  "exp": 1713096000,
  "iat": 1712491200
}`}
              </pre>
            </div>
          </SectionCard>
        </div>

        {/* 6. Quality Classification */}
        <div id="quality">
          <SectionCard title="Algoritma Klasifikasi Mutu Lateks" icon={BarChart3} color="text-cyan-400">
            <p className="text-xs text-muted-foreground mb-3">
              Klasifikasi dilakukan secara berlapis berdasarkan threshold yang sama dengan firmware ESP32.
            </p>
            <div className="rounded-lg border bg-background/50 p-4 overflow-x-auto">
              <MermaidDiagram chart={qualityFlowChart} id="quality-flow" />
            </div>
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-foreground mb-2">📊 Threshold Klasifikasi:</h4>
              <InfoTable
                headers={["Parameter", "Kondisi", "Hasil Klasifikasi", "Status"]}
                rows={[
                  ["TDS", "≤ 200 ppm", "Tidak Ada Sampel", "⚪ Probe Kering"],
                  ["pH", "≤ 7.5", "Mutu Rendah (Asam)", "🟡 Warning"],
                  ["pH", "≥ 8.8", "Terawetkan Amonia", "🟠 Warning"],
                  ["TDS", "≤ 500 ppm (pH normal)", "Mutu Prima", "🟢 OK"],
                  ["TDS", "501-1100 ppm", "Indikasi Kontaminasi", "🔴 Danger"],
                  ["TDS", "> 1100 ppm", "Indikasi Oplos Air", "🔴 Danger"],
                ]}
              />
            </div>
            <div className="mt-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-[11px] text-muted-foreground">
              <strong className="text-yellow-400">⚠️ Catatan:</strong>{" "}
              Evaluasi menggunakan 2 lapis: Lapis 1 (pH) → Lapis 2 (TDS). pH normal = 7.6 – 8.7. Threshold identik dengan firmware ESP32 yang tertanam di mikrokontroller.
            </div>
          </SectionCard>
        </div>

        {/* 7. API Reference */}
        <div id="api">
          <SectionCard title="API Endpoints Reference" icon={Globe} color="text-pink-400">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                  🔐 Authentication
                </h4>
                <InfoTable
                  headers={["Method", "Endpoint", "Deskripsi", "Auth"]}
                  rows={[
                    ["POST", "/api/auth/login", "Login user", "❌"],
                    ["POST", "/api/auth/register", "Register petani baru", "❌"],
                  ]}
                />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                  👤 Profile
                </h4>
                <InfoTable
                  headers={["Method", "Endpoint", "Deskripsi", "Auth"]}
                  rows={[
                    ["GET", "/api/profile", "Ambil profil saya", "✅ JWT"],
                    ["PUT", "/api/profile", "Update profil + sync owner", "✅ JWT"],
                    ["POST", "/api/profile/password", "Ganti password", "✅ JWT"],
                  ]}
                />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                  📊 Measurements
                </h4>
                <InfoTable
                  headers={["Method", "Endpoint", "Deskripsi", "Auth"]}
                  rows={[
                    ["GET", "/api/measurements", "Daftar pengukuran (filter, pagination)", "✅ JWT"],
                    ["POST", "/api/measurements", "Tambah data baru", "✅ Admin"],
                    ["PATCH", "/api/measurements/:id", "Update owner/lokasi", "✅ Admin"],
                    ["DELETE", "/api/measurements/:id", "Hapus satu data", "✅ Admin"],
                    ["POST", "/api/measurements/bulk-delete", "Hapus banyak data", "✅ Admin"],
                    ["DELETE", "/api/measurements", "Hapus data (filter)", "✅ Admin"],
                  ]}
                />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                  📱 Devices & Owners
                </h4>
                <InfoTable
                  headers={["Method", "Endpoint", "Deskripsi", "Auth"]}
                  rows={[
                    ["GET", "/api/devices", "Status device ESP32", "✅ JWT"],
                    ["GET", "/api/device-logs", "Raw MQTT logs", "✅ JWT"],
                    ["GET", "/api/owners", "List pemilik latex", "✅ JWT"],
                    ["POST", "/api/owners", "Tambah pemilik baru", "✅ Admin"],
                    ["GET", "/api/owners/:name", "Detail pemilik + stats", "✅ JWT"],
                    ["DELETE", "/api/owners/:name", "Hapus pemilik", "✅ Admin"],
                  ]}
                />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                  🛡️ Admin Management
                </h4>
                <InfoTable
                  headers={["Method", "Endpoint", "Deskripsi", "Auth"]}
                  rows={[
                    ["GET", "/api/admin/users", "List semua user", "✅ Admin"],
                    ["PATCH", "/api/admin/users/:id/role", "Ubah role user", "✅ Admin"],
                    ["DELETE", "/api/admin/users/:id", "Hapus user", "✅ Admin"],
                    ["POST", "/api/admin/users/:id/notify", "Kirim notifikasi ke user", "✅ Admin"],
                  ]}
                />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                  🧑‍🌾 Farmer Endpoints
                </h4>
                <InfoTable
                  headers={["Method", "Endpoint", "Deskripsi", "Auth"]}
                  rows={[
                    ["GET", "/api/farmer/my-owners", "Pemilik yang di-assign", "✅ JWT"],
                    ["GET", "/api/farmer/stats", "Statistik petani", "✅ JWT"],
                    ["GET", "/api/notifications", "Notifikasi saya", "✅ JWT"],
                    ["PATCH", "/api/notifications/:id/read", "Tandai notif dibaca", "✅ JWT"],
                    ["POST", "/api/notifications/read-all", "Tandai semua dibaca", "✅ JWT"],
                  ]}
                />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* 8. Deployment */}
        <div id="deployment">
          <SectionCard title="Deployment & Infrastruktur" icon={Server} color="text-indigo-400">
            <p className="text-xs text-muted-foreground mb-3">
              Arsitektur deployment untuk development dan production.
            </p>
            <div className="rounded-lg border bg-background/50 p-4 overflow-x-auto">
              <MermaidDiagram chart={deploymentChart} id="deployment" />
            </div>
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-foreground mb-2">🔧 Environment Variables:</h4>
              <InfoTable
                headers={["Variable", "Deskripsi", "Contoh"]}
                rows={[
                  ["DATABASE_URL", "Connection string PostgreSQL", "postgres://user:pass@host/db"],
                  ["JWT_SECRET", "Secret key untuk signing JWT", "random-string-min-32-char"],
                  ["PORT", "Port backend API", "3001"],
                  ["MQTT_URL", "MQTT broker URL", "mqtt://broker.hivemq.com:1883"],
                  ["MQTT_USERNAME", "MQTT auth (opsional)", "—"],
                  ["MQTT_PASSWORD", "MQTT auth (opsional)", "—"],
                  ["MQTT_CLIENT_ID", "Client ID untuk broker", "latexguard-dashboard"],
                  ["DEVICE_OFFLINE_SECONDS", "Threshold offline device", "60"],
                ]}
              />
            </div>
            <div className="mt-3">
              <h4 className="text-xs font-semibold text-foreground mb-2">📂 Struktur Direktori:</h4>
              <pre className="p-3 rounded-lg bg-muted/30 text-[11px] font-mono text-muted-foreground overflow-x-auto leading-relaxed">
{`├── db/
│   └── migrations/         # SQL migration files
├── server/
│   ├── auth/jwt.ts         # JWT sign/verify
│   ├── db/pool.ts          # PostgreSQL connection pool
│   ├── db/seed.ts          # Demo data seeder
│   ├── iot/
│   │   ├── classify.ts     # Algoritma klasifikasi mutu
│   │   ├── mqtt.ts         # MQTT client HiveMQ
│   │   └── parser.ts       # Payload parser
│   ├── middleware/auth.ts   # JWT middleware
│   ├── realtime/ws.ts       # WebSocket broadcast
│   ├── services/mqtt-handler.ts
│   └── index.ts             # Express app entry
├── src/
│   ├── components/          # UI components (shadcn/ui)
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities (api, realtime)
│   └── pages/
│       ├── farmer/          # Farmer dashboard pages
│       └── *.tsx            # Admin pages
└── vite.config.ts           # Vite + proxy config`}
              </pre>
            </div>
          </SectionCard>
        </div>

        {/* 9. Tech Stack */}
        <div id="tech">
          <SectionCard title="Technology Stack" icon={Code2} color="text-green-400">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-muted/10 space-y-2">
                <h4 className="text-xs font-semibold text-foreground">🖥️ Frontend</h4>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="blue">React 18</Badge>
                  <Badge variant="blue">TypeScript</Badge>
                  <Badge variant="blue">Vite</Badge>
                  <Badge variant="blue">React Router v6</Badge>
                  <Badge variant="green">shadcn/ui</Badge>
                  <Badge variant="green">Radix UI</Badge>
                  <Badge variant="green">Recharts</Badge>
                  <Badge variant="green">Framer Motion</Badge>
                  <Badge variant="green">Mermaid.js</Badge>
                  <Badge variant="green">Lucide Icons</Badge>
                  <Badge variant="green">TanStack Query</Badge>
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-muted/10 space-y-2">
                <h4 className="text-xs font-semibold text-foreground">⚙️ Backend</h4>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="orange">Node.js</Badge>
                  <Badge variant="orange">Express.js</Badge>
                  <Badge variant="orange">TypeScript</Badge>
                  <Badge variant="orange">tsx (hot reload)</Badge>
                  <Badge variant="blue">PostgreSQL (Neon)</Badge>
                  <Badge variant="blue">pg driver</Badge>
                  <Badge variant="blue">bcryptjs</Badge>
                  <Badge variant="blue">jsonwebtoken</Badge>
                  <Badge variant="blue">zod</Badge>
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-muted/10 space-y-2">
                <h4 className="text-xs font-semibold text-foreground">📡 IoT / Realtime</h4>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="red">ESP32</Badge>
                  <Badge variant="red">MQTT Protocol</Badge>
                  <Badge variant="orange">HiveMQ Broker</Badge>
                  <Badge variant="orange">WebSocket (ws)</Badge>
                  <Badge variant="green">Realtime Push</Badge>
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-muted/10 space-y-2">
                <h4 className="text-xs font-semibold text-foreground">🚀 DevOps / Deploy</h4>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="blue">Vercel</Badge>
                  <Badge variant="blue">Neon PostgreSQL</Badge>
                  <Badge variant="green">Git</Badge>
                  <Badge variant="green">npm</Badge>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Footer */}
        <div className="text-center py-6 border-t text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">LatexGuard v1.0</p>
          <p>© 2026 — Skripsi IoT Monitoring Kualitas Lateks</p>
          <p className="text-[10px]">Dibuat dengan React, Express, PostgreSQL, MQTT, dan ESP32</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
