import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState, StatCard, ProgressBar } from "@/components/ui-bits";
import type { UsageCounter } from "@/lib/types";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/usage")({
  component: UsagePage,
});

function UsagePage() {
  const { companyId } = useCompany();

  const { data, isLoading } = useQuery({
    queryKey: ["usage-current", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const { data } = await supabase
        .from("usage_counters")
        .select("*")
        .eq("company_id", companyId)
        .gte("period_start", start)
        .lt("period_start", end)
        .maybeSingle();
      if (data) return data as UsageCounter;
      // fallback: latest
      const { data: latest } = await supabase
        .from("usage_counters")
        .select("*")
        .eq("company_id", companyId)
        .order("period_start", { ascending: false })
        .limit(1);
      return (latest?.[0] as UsageCounter) ?? null;
    },
  });

  if (isLoading) return <LoadingState />;

  if (!data) {
    return (
      <div>
        <PageHeader title="Uso mensual" subtitle="Consulta el consumo de mensajes y tokens de tu cuenta." />
        <EmptyState title="Todavía no hay consumo registrado este mes." />
      </div>
    );
  }

  const msgUsed = data.messages_used ?? 0;
  const msgLimit = data.messages_limit ?? 0;
  const tokUsed = data.tokens_used ?? 0;
  const tokLimit = data.tokens_limit ?? 0;
  const msgPct = msgLimit > 0 ? (msgUsed / msgLimit) * 100 : 0;
  const tokPct = tokLimit > 0 ? (tokUsed / tokLimit) * 100 : 0;

  return (
    <div>
      <PageHeader title="Uso mensual" subtitle="Consulta el consumo de mensajes y tokens de tu cuenta." />

      {msgPct >= 100 && (
        <Alert tone="danger" message="Tu cuenta alcanzó el límite mensual de respuestas." />
      )}
      {msgPct >= 80 && msgPct < 100 && (
        <Alert tone="warning" message="Tu cuenta está cerca del límite mensual de respuestas." />
      )}
      {tokPct >= 80 && (
        <Alert tone="warning" message="Tu consumo de tokens supera el 80% del límite." />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
        <StatCard label="Mensajes usados" value={msgUsed}>
          <div className="mt-3"><ProgressBar value={msgUsed} max={msgLimit} tone={msgPct >= 100 ? "danger" : msgPct >= 80 ? "warning" : "primary"} /></div>
          <div className="text-xs text-muted-foreground mt-1">Límite: {msgLimit}</div>
        </StatCard>
        <StatCard label="Tokens usados" value={tokUsed}>
          <div className="mt-3"><ProgressBar value={tokUsed} max={tokLimit} tone={tokPct >= 100 ? "danger" : tokPct >= 80 ? "warning" : "primary"} /></div>
          <div className="text-xs text-muted-foreground mt-1">Límite: {tokLimit}</div>
        </StatCard>
        <StatCard label="Costo estimado IA" value={data.estimated_ai_cost != null ? `$${data.estimated_ai_cost}` : "—"} />
        <StatCard
          label="Periodo actual"
          value={
            data.period_start
              ? `${new Date(data.period_start).toLocaleDateString("es")} – ${data.period_end ? new Date(data.period_end).toLocaleDateString("es") : ""}`
              : "—"
          }
        />
      </div>
    </div>
  );
}

function Alert({ tone, message }: { tone: "warning" | "danger"; message: string }) {
  const cls =
    tone === "danger"
      ? "bg-[color:var(--destructive)]/10 border-[color:var(--destructive)]/30 text-[color:var(--destructive)]"
      : "bg-[color:var(--warning)]/20 border-[color:var(--warning)]/40 text-[color:var(--warning-foreground)]";
  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 flex items-center gap-2 ${cls}`}>
      <AlertTriangle className="h-4 w-4" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
