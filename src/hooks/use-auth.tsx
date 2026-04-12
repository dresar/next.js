import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { apiFetch, setToken } from "@/lib/api";
import { reconnectRealtime } from "@/lib/realtime";
import { clearFarmerCache } from "@/hooks/use-farmer-cache";

export type UserRole = "admin" | "petani";

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  demoLogin: () => Promise<void>;
  demoLoginPetani: () => Promise<void>;
  register: (data: { email: string; password: string; full_name: string; phone?: string; address?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  demoLogin: async () => {},
  demoLoginPetani: async () => {},
  register: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await apiFetch<{ user: AuthUser }>("/api/auth/me");
        if (!cancelled) setUser(me.user);
      } catch {
        // not logged in
        setToken(null);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: AuthUser }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    );
    setToken(data.token);
    setUser(data.user);
    reconnectRealtime();
  };

  const signOut = async () => {
    setToken(null);
    setUser(null);
    clearFarmerCache();
    reconnectRealtime();
  };

  const demoLogin = async () => {
    await signIn("demo@latexguard.local", "demo12345");
  };

  const demoLoginPetani = async () => {
    await signIn("petani1@latexguard.local", "petani123");
  };

  const register = async (data: { email: string; password: string; full_name: string; phone?: string; address?: string }) => {
    const res = await apiFetch<{ token: string; user: AuthUser }>(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify(data) }
    );
    setToken(res.token);
    setUser(res.user);
    reconnectRealtime();
  };

  const value = useMemo<AuthContextType>(() => ({
    user,
    loading,
    signIn,
    signOut,
    demoLogin,
    demoLoginPetani,
    register,
  }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
