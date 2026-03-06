import type { StatusColor } from "@/lib/latex-utils";

const styles: Record<StatusColor, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
};

export function StatusBadge({ status, color }: { status: string; color: StatusColor }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[color]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${color === "success" ? "bg-success" : color === "warning" ? "bg-warning" : "bg-destructive"}`} />
      {status}
    </span>
  );
}
