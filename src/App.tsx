import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Admin pages
import Dashboard from "./pages/Dashboard";
import Measurements from "./pages/Measurements";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import DeviceMonitoring from "./pages/DeviceMonitoring";
import OwnersPage from "./pages/OwnersPage";
import AdminUsers from "./pages/AdminUsers";
import AdminNotifications from "./pages/AdminNotifications";
import DocumentationPage from "./pages/DocumentationPage";

// Farmer pages
import FarmerDashboard from "./pages/farmer/FarmerDashboard";
import FarmerMeasurements from "./pages/farmer/FarmerMeasurements";
import FarmerNotifications from "./pages/farmer/FarmerNotifications";
import FarmerProfile from "./pages/farmer/FarmerProfile";

import { queryClient } from "@/lib/query-client";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Admin Routes — semua pakai /admin/ prefix */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><Dashboard /></ProtectedRoute>} />
            <Route path="/admin/measurements" element={<ProtectedRoute allowedRoles={["admin"]}><Measurements /></ProtectedRoute>} />
            <Route path="/admin/devices" element={<ProtectedRoute allowedRoles={["admin"]}><DeviceMonitoring /></ProtectedRoute>} />
            <Route path="/admin/owners" element={<ProtectedRoute allowedRoles={["admin"]}><OwnersPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["admin"]}><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/notifications" element={<ProtectedRoute allowedRoles={["admin"]}><AdminNotifications /></ProtectedRoute>} />
            <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={["admin"]}><Profile /></ProtectedRoute>} />
            <Route path="/admin/docs" element={<ProtectedRoute allowedRoles={["admin"]}><DocumentationPage /></ProtectedRoute>} />

            {/* Backward compatibility — redirect old paths to /admin/ */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/measurements" element={<Navigate to="/admin/measurements" replace />} />
            <Route path="/devices" element={<Navigate to="/admin/devices" replace />} />
            <Route path="/owners" element={<Navigate to="/admin/owners" replace />} />
            <Route path="/profile" element={<Navigate to="/admin/profile" replace />} />
            <Route path="/notifications" element={<Navigate to="/admin/notifications" replace />} />

            {/* Farmer Routes */}
            <Route path="/farmer" element={<ProtectedRoute allowedRoles={["petani"]}><FarmerDashboard /></ProtectedRoute>} />
            <Route path="/farmer/data" element={<ProtectedRoute allowedRoles={["petani"]}><FarmerMeasurements /></ProtectedRoute>} />
            <Route path="/farmer/notif" element={<ProtectedRoute allowedRoles={["petani"]}><FarmerNotifications /></ProtectedRoute>} />
            <Route path="/farmer/profile" element={<ProtectedRoute allowedRoles={["petani"]}><FarmerProfile /></ProtectedRoute>} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
