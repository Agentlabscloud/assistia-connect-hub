import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ message = "Cargando…", className }: { message?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-10 text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-white p-10 text-center">
      {icon && <div className="mx-auto mb-3 text-muted-foreground">{icon}</div>}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value?: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {value !== undefined && <div className="mt-2 text-2xl font-semibold">{value}</div>}
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      {children}
    </div>
  );
}

type Status = "connected" | "active" | "pending" | "draft" | "failed" | "error" | string;

export function StatusBadge({ status, children }: { status: Status; children?: ReactNode }) {
  const map: Record<string, string> = {
    connected: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
    active: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
    pending: "bg-[color:var(--warning)]/20 text-[color:var(--warning-foreground)] border-[color:var(--warning)]/40",
    draft: "bg-[color:var(--warning)]/20 text-[color:var(--warning-foreground)] border-[color:var(--warning)]/40",
    failed: "bg-[color:var(--destructive)]/15 text-[color:var(--destructive)] border-[color:var(--destructive)]/30",
    error: "bg-[color:var(--destructive)]/15 text-[color:var(--destructive)] border-[color:var(--destructive)]/30",
  };
  const klass = map[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", klass)}>
      {children ?? status}
    </span>
  );
}

export function ProgressBar({ value, max, tone = "primary" }: { value: number; max: number; tone?: "primary" | "warning" | "danger" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color =
    tone === "danger"
      ? "bg-[color:var(--destructive)]"
      : tone === "warning"
      ? "bg-[color:var(--warning)]"
      : "bg-[color:var(--brand-green)]";
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
