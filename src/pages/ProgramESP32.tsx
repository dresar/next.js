import { DashboardLayout } from "@/components/DashboardLayout";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download, FileCode, Bot, User, Send, Loader2, BookOpen, Save, RotateCcw, Code2 } from "lucide-react";
import { toast } from "sonner";
import { FIRMWARE_CODE as DEFAULT_FIRMWARE_CODE, FIRMWARE_FILENAME } from "@/content/esp32-firmware-sample";
import { sendAiChat, type ChatMessage } from "@/lib/ai-chat";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const STORAGE_KEY = "latex-esp32-firmware";

const ESP32_SYSTEM_PROMPT = `Kamu adalah asisten ahli untuk firmware ESP32 dan sistem IoT Latex Monitor. Jawab dalam Bahasa Indonesia.
Topik: Arduino/ESP32, sensor TDS/suhu, MQTT (broker.hivemq.com:1883, no auth, topic latex/iot/data dan latex/iot/status), debugging sensor, konfigurasi WiFi, dan kode C++.
Jika user minta mengubah, memperbaiki, atau menambah fitur pada kode firmware, berikan kode LENGKAP yang sudah dimodifikasi dalam satu blok markdown: \`\`\`cpp ... \`\`\` (tanpa penjelasan di dalam blok). User bisa klik "Terapkan ke editor" untuk memasukkan kode tersebut ke editor.`;

function getStoredCode(): string {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return s;
  } catch {
    // ignore
  }
  return DEFAULT_FIRMWARE_CODE;
}

export default function ProgramESP32() {
  const [code, setCode] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Halo! Saya AI Assistant untuk kode ESP32 dan Latex Monitor. Anda bisa bertanya tentang firmware, MQTT, sensor TDS/suhu, atau debugging. Silakan tanya!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCode(getStoredCode());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveCode = () => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
      setSaved(true);
      toast.success("Kode disimpan. Perubahan akan dipakai saat Copy/Download.");
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Gagal menyimpan ke browser");
    }
  };

  const resetCode = () => {
    setCode(DEFAULT_FIRMWARE_CODE);
    toast.info("Kode dikembalikan ke versi default");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    toast.success("Kode disalin ke clipboard");
  };

  const downloadFirmware = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = FIRMWARE_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File firmware berhasil diunduh");
  };

  function extractCodeBlock(text: string): string | null {
    const match = text.match(/```(?:cpp|c|ino)?\s*([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userContent = input.trim();
    const userMsg: ChatMessage = { role: "user", content: userContent };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const reply = await sendAiChat(ESP32_SYSTEM_PROMPT, messages, userContent);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Terjadi kesalahan koneksi. Silakan coba lagi." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const applyCodeFromMessage = (content: string) => {
    const extracted = extractCodeBlock(content);
    if (extracted) {
      setCode(extracted);
      toast.success("Kode dari AI telah diterapkan ke editor");
    } else {
      toast.error("Tidak ada blok kode dalam pesan ini");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Program ESP32</h1>
          <p className="text-sm text-muted-foreground">
            Edit kode firmware Latex Monitor, simpan, dan gunakan AI Assistant untuk bantuan.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Code editor */}
          <div className="xl:col-span-2 rounded-xl border bg-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileCode className="h-4 w-4" />
                {FIRMWARE_FILENAME}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={saveCode} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> {saved ? "Tersimpan" : "Simpan"}
                </Button>
                <Button variant="outline" size="sm" onClick={resetCode} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
                <Button variant="outline" size="sm" onClick={copyCode} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <Button variant="outline" size="sm" onClick={downloadFirmware} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full min-h-[380px] max-h-[520px] p-4 text-xs sm:text-sm font-mono bg-muted/20 text-foreground leading-relaxed resize-y border-0 focus:ring-0 focus:outline-none focus-visible:ring-0"
              placeholder="Kode firmware..."
            />
          </div>

          {/* AI chat panel */}
          <div className="rounded-xl border bg-card overflow-hidden flex flex-col min-h-[400px]">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">AI Assistant</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div className="max-w-[85%] space-y-2">
                    <div
                      className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-card-foreground"
                      }`}
                    >
                      {msg.content}
                    </div>
                    {msg.role === "assistant" && extractCodeBlock(msg.content) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => applyCodeFromMessage(msg.content)}
                      >
                        <Code2 className="h-3.5 w-3.5" /> Terapkan ke editor
                      </Button>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2">
                  <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="border-t p-3"
            >
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Tanya tentang kode, MQTT, sensor..."
                  disabled={loading}
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <Button type="submit" disabled={loading || !input.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Dokumentasi singkat */}
        <Collapsible open={docsOpen} onOpenChange={setDocsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              Dokumentasi singkat firmware
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-xl border bg-card p-4 mt-2 text-sm text-muted-foreground space-y-2">
              <p>
                <strong className="text-foreground">WiFi (di kode ESP32):</strong> Ubah <code className="bg-muted px-1 rounded">WIFI_SSID</code> dan <code className="bg-muted px-1 rounded">WIFI_PASS</code> di firmware sesuai jaringan Anda.
              </p>
              <p>
                <strong className="text-foreground">MQTT Broker:</strong> broker.hivemq.com:1883 — <strong>tanpa auth</strong> (username/password kosong). Backend .env: <code className="bg-muted px-1 rounded">MQTT_URL=mqtt://broker.hivemq.com:1883</code>, <code className="bg-muted px-1 rounded">MQTT_USERNAME</code> dan <code className="bg-muted px-1 rounded">MQTT_PASSWORD</code> boleh kosong.
              </p>
              <p>
                <strong className="text-foreground">Topic data:</strong> <code className="bg-muted px-1 rounded">latex/iot/data</code> — payload JSON: temp, tds, volt, battery, status (liquid_detected / probe_dry), timestamp.
              </p>
              <p>
                <strong className="text-foreground">Topic status:</strong> <code className="bg-muted px-1 rounded">latex/iot/status</code> — payload: mqtt_connected, wifi_connected, battery, status.
              </p>
              <p>
                Dashboard menerima data realtime via WebSocket setelah backend menerima dari MQTT. Pastikan backend jalan (<code className="bg-muted px-1 rounded">npm run dev</code>) dan .env sudah benar.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </DashboardLayout>
  );
}
