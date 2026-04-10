import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    // Return blank screen instead of spinner during < 200ms auth check
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
