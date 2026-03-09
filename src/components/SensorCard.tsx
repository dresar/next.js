import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface SensorCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon: LucideIcon;
  variant?: "primary" | "success" | "warning" | "danger";
  subtitle?: string;
}

const variantStyles = {
  primary: "sensor-card-glow border-primary/20",
  success: "sensor-card-success border-success/20",
  warning: "sensor-card-warning border-warning/20",
  danger: "sensor-card-danger border-destructive/20",
};

const iconBg = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

const isPlaceholder = (v: string | number) =>
  typeof v === "string" && (v === "Menunggu Data Sensor" || v.length > 15);

export function SensorCard({ title, value, unit, icon: Icon, variant = "primary", subtitle }: SensorCardProps) {
  const showPlaceholder = isPlaceholder(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-xl border bg-card p-5 min-h-[120px] flex flex-col ${variantStyles[variant]} transition-all hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-1">
            <span
              className={`font-bold font-mono text-card-foreground ${showPlaceholder ? "text-sm" : "text-2xl sm:text-3xl"}`}
            >
              {value}
            </span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{subtitle}</p>}
        </div>
        <div className={`rounded-lg p-2.5 shrink-0 ${iconBg[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
