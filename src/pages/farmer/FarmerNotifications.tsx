import { FarmerLayout } from "@/components/FarmerLayout";
import { useNotifications, type Notification } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, CheckCheck, Info, AlertTriangle, CheckCircle, XOctagon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const typeConfig = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  success: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  danger: { icon: XOctagon, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
};

export default function FarmerNotifications() {
  const { notifications, unreadCount, loading, markAsRead, markAllRead } = useNotifications();

  return (
    <FarmerLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifikasi
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} belum dibaca` : "Semua sudah dibaca"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5 text-xs self-start">
              <CheckCheck className="h-4 w-4" />
              Tandai Semua Dibaca
            </Button>
          )}
        </div>

        {/* Notification List */}
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <BellOff className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Belum ada notifikasi</p>
            </div>
          ) : (
            <AnimatePresence>
              {notifications.map((notif, i) => {
                const cfg = typeConfig[notif.type] ?? typeConfig.info;
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ delay: i * 0.03, duration: 0.3 }}
                    className={`rounded-xl border ${notif.is_read ? "bg-card" : `${cfg.bg} ${cfg.border}`} p-3 sm:p-4 transition-all`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`h-4 w-4 ${cfg.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className={`text-sm font-semibold ${notif.is_read ? "text-foreground" : "text-foreground"}`}>
                            {notif.title}
                          </h3>
                          {!notif.is_read && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="text-[10px] text-primary font-medium hover:underline whitespace-nowrap shrink-0"
                            >
                              Tandai dibaca
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {new Date(notif.created_at).toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </FarmerLayout>
  );
}
