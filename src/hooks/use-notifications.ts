import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { subscribeRealtime } from "@/lib/realtime";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "danger";
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch<{ notifications: Notification[]; unread_count: number }>("/api/notifications?limit=50");
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || fetchedRef.current) return;
    fetchedRef.current = true;
    fetchNotifications();
  }, [user, fetchNotifications]);

  // Reset on user change
  useEffect(() => {
    if (!user) {
      fetchedRef.current = false;
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user]);

  // Listen for realtime notifications via WebSocket
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeRealtime((evt) => {
      if (evt.type === "notification:new") {
        const data = evt.data as { user_id?: string };
        if (data.user_id === user.id) {
          // Refetch notifications
          fetchNotifications();
          toast.info("🔔 Notifikasi baru!");
        }
      }
    });
    return () => unsub();
  }, [user, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await apiFetch("/api/notifications/read-all", { method: "PATCH" });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllRead,
    refetch: fetchNotifications,
  };
}
