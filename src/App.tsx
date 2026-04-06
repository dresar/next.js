import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Measurements from "./pages/Measurements";
import AIAssistant from "./pages/AIAssistant";
import AnalyticsPage from "./pages/AnalyticsPage";
import Profile from "./pages/Profile";
import SettingsPage from "./pages/SettingsPage";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import DeviceMonitoring from "./pages/DeviceMonitoring";
import DataLogger from "./pages/DataLogger";
import OtaMonitor from "./pages/OtaMonitor";
import ProgramESP32 from "./pages/ProgramESP32";
import OwnersPage from "./pages/OwnersPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/measurements" element={<ProtectedRoute><Measurements /></ProtectedRoute>} />
            <Route path="/devices" element={<ProtectedRoute><DeviceMonitoring /></ProtectedRoute>} />
            <Route path="/data-logger" element={<ProtectedRoute><DataLogger /></ProtectedRoute>} />
            <Route path="/ota" element={<ProtectedRoute><OtaMonitor /></ProtectedRoute>} />
            <Route path="/program-esp32" element={<ProtectedRoute><ProgramESP32 /></ProtectedRoute>} />
            <Route path="/owners" element={<ProtectedRoute><OwnersPage /></ProtectedRoute>} />
            <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
