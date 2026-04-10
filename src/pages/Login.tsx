import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Droplets, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { prefetchMeasurements } from "@/hooks/use-measurements";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, demoLogin } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      // Hard Cache Prefetch (Background) 
      prefetchMeasurements().catch(console.error);
      navigate("/");
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "Gagal login";
      toast.error(message);
    }
    setLoading(false);
  };

  const handleDemo = async () => {
    setLoading(true);
    try {
      await demoLogin();
      // Hard Cache Prefetch (Background)
      prefetchMeasurements().catch(console.error);
      navigate("/");
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "Gagal quick login";
      toast.error(message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center sensor-card-glow">
            <Droplets className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">LatexGuard</h1>
          <p className="text-sm text-muted-foreground">IoT Monitoring Kualitas Lateks</p>
        </div>

        <form onSubmit={handleLogin} className="rounded-xl border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="email@contoh.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Kata Sandi</Label>
            <div className="relative">
              <Input type={showPass ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Memproses..." : "Masuk"}</Button>
            <Button type="button" variant="outline" className="w-full" onClick={handleDemo} disabled={loading}>
              Quick Login (Demo)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Demo: <span className="font-mono">demo@latexguard.local</span> / <span className="font-mono">demo12345</span>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
