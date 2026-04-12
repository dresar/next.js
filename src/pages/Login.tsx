import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Droplets, Eye, EyeOff, UserPlus, LogIn, Leaf, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { prefetchMeasurements } from "@/hooks/use-measurements";
import { prefetchAllFarmerData } from "@/hooks/use-farmer-cache";
import { motion, AnimatePresence } from "framer-motion";

const Login = () => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, demoLogin, demoLoginPetani, register } = useAuth();

  // Register fields
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);

  const redirectByRole = (role: string) => {
    if (role === "petani") navigate("/farmer");
    else navigate("/");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      // Get role from localStorage token
      const token = localStorage.getItem("auth_token");
      let role = "admin";
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          role = payload.role ?? "admin";
        } catch {}
      }

      // Prefetch data sesuai role SEBELUM navigasi — halaman langsung tampil tanpa loading
      if (role === "petani") {
        await prefetchAllFarmerData();
      } else {
        prefetchMeasurements().catch(console.error);
      }

      redirectByRole(role);
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "Gagal login";
      toast.error(message);
    }
    setLoading(false);
  };

  const handleDemo = async (type: "admin" | "petani") => {
    setLoading(true);
    try {
      if (type === "admin") {
        await demoLogin();
        prefetchMeasurements().catch(console.error);
        navigate("/");
      } else {
        await demoLoginPetani();
        // Prefetch SEMUA data petani sebelum navigasi — zero loading di farmer page
        await prefetchAllFarmerData();
        navigate("/farmer");
      }
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "Gagal quick login";
      toast.error(message);
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      toast.error("Nama lengkap wajib diisi");
      return;
    }
    setLoading(true);
    try {
      await register({
        email: regEmail,
        password: regPassword,
        full_name: regName,
        phone: regPhone || undefined,
        address: regAddress || undefined,
      });
      toast.success("Registrasi berhasil! Selamat datang 🎉");
      navigate("/farmer");
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "Gagal mendaftar";
      toast.error(message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-6"
      >
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center sensor-card-glow"
          >
            <Droplets className="h-8 w-8 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-bold gradient-text">LatexGuard</h1>
          <p className="text-sm text-muted-foreground">IoT Monitoring Kualitas Lateks</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex rounded-xl border bg-muted/30 p-1 gap-1">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
              mode === "login"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LogIn className="h-4 w-4" />
            Masuk
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
              mode === "register"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Daftar Petani
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === "login" ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <form onSubmit={handleLogin} className="rounded-xl border bg-card/80 backdrop-blur-sm p-6 space-y-4 shadow-lg">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@contoh.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kata Sandi</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>
                  {loading ? "Memproses..." : "Masuk"}
                </Button>

                {/* Quick Login Buttons */}
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground text-center font-medium">Quick Login Demo</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 h-10 text-xs"
                      onClick={() => handleDemo("admin")}
                      disabled={loading}
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Admin Demo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 h-10 text-xs"
                      onClick={() => handleDemo("petani")}
                      disabled={loading}
                    >
                      <Leaf className="h-3.5 w-3.5" />
                      Petani Demo
                    </Button>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1">
                  <p>Admin: <span className="font-mono">demo@latexguard.local</span> / <span className="font-mono">demo12345</span></p>
                  <p>Petani: <span className="font-mono">petani1@latexguard.local</span> / <span className="font-mono">petani123</span></p>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <form onSubmit={handleRegister} className="rounded-xl border bg-card/80 backdrop-blur-sm p-6 space-y-4 shadow-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground pb-1">
                  <Leaf className="h-4 w-4 text-green-500" />
                  <span>Daftar sebagai <span className="font-semibold text-foreground">Petani</span></span>
                </div>

                <div className="space-y-2">
                  <Label>Nama Lengkap <span className="text-destructive">*</span></Label>
                  <Input
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Nama lengkap Anda"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="email@contoh.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kata Sandi <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      type={showRegPass ? "text" : "password"}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPass(!showRegPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showRegPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>No. Telepon</Label>
                    <Input
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Alamat</Label>
                    <Input
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="Alamat lengkap"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>
                  {loading ? "Memproses..." : "Daftar Sekarang"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Petani baru akan mendapat akses setelah admin menetapkan pemilik latex.
                </p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Login;
