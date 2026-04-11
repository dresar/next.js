import { Navigate } from "react-router-dom";
import { useAuth, type UserRole } from "@/hooks/use-auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) return <Navigate to="/login" replace />;

  // Role-based redirect
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "petani") {
      return <Navigate to="/farmer" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
