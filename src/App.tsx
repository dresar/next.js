import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Admin pages
import Dashboard from "./pages/Dashboard";
import Measurements from "./pages/Measurements";
import AnalyticsPage from "./pages/AnalyticsPage";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import DeviceMonitoring from "./pages/DeviceMonitoring";
import DataLogger from "./pages/DataLogger";
import OtaMonitor from "./pages/OtaMonitor";
import OwnersPage from "./pages/OwnersPage";
import AdminUsers from "./pages/AdminUsers";
import AdminNotifications from "./pages/AdminNotifications";

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

            {/* Admin Routes */}
            <Route path="/" element={<ProtectedRoute allowedRoles={["admin"]}><Dashboard /></ProtectedRoute>} />
            <Route path="/measurements" element={<ProtectedRoute allowedRoles={["admin"]}><Measurements /></ProtectedRoute>} />
            <Route path="/devices" element={<ProtectedRoute allowedRoles={["admin"]}><DeviceMonitoring /></ProtectedRoute>} />
            <Route path="/data-logger" element={<ProtectedRoute allowedRoles={["admin"]}><DataLogger /></ProtectedRoute>} />
            <Route path="/ota" element={<ProtectedRoute allowedRoles={["admin"]}><OtaMonitor /></ProtectedRoute>} />
            <Route path="/owners" element={<ProtectedRoute allowedRoles={["admin"]}><OwnersPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={["admin"]}><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute allowedRoles={["admin"]}><Profile /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={["admin"]}><AdminUsers /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute allowedRoles={["admin"]}><AdminNotifications /></ProtectedRoute>} />

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
