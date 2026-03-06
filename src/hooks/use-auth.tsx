import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { apiFetch, setToken } from "@/lib/api";
import { reconnectRealtime } from "@/lib/realtime";

interface AuthContextType {
  user: { id: string; email: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  demoLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  demoLogin: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await apiFetch<{ user: { id: string; email: string } }>("/api/auth/me");
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
    const data = await apiFetch<{ token: string; user: { id: string; email: string } }>(
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
    reconnectRealtime();
  };

  const demoLogin = async () => {
    await signIn("demo@latexguard.local", "demo12345");
  };

  const value = useMemo<AuthContextType>(() => ({
    user,
    loading,
    signIn,
    signOut,
    demoLogin,
  }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
