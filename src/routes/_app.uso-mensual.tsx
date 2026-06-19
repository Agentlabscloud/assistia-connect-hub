import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, StatCard, ProgressBar } from "@/components/ui-bits";
import type { UsageCounter, Subscription } from "@/lib/types";
import { DEFAULT_MESSAGE_LIMIT } from "@/lib/types";
import { UsageAlert } from "@/routes/_app.dashboard";
import { currentPeriodMonth, formatPeriodMonth } from "@/lib/i18n";

export const Route = createFileRoute("/_app/uso-mensual")({
  component: UsagePage,
});

function UsagePage() {
  const { companyId } = useCompany();

  const usageQ = useQuery({
    queryKey: ["usage-current", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const month = currentPeriodMonth();
      const { data: cur } = await supabase
        .from("usage_counters")
        .select("id,company_id,period_month,messages_used,messages_limit")
        .eq("company_id", companyId)
        .eq("period_month", month)
        .maybeSingle();
      return (cur as UsageCounter) ?? null;
    },
  });

  const subQ = useQuery({
    queryKey: ["sub", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id,company_id,included_messages")
        .eq("company_id", companyId)
        .maybeSingle();
      return (data as Subscription) ?? null;
    },
  });

  if (usageQ.isLoading) return <LoadingState />;

  const usage = usageQ.data;
  const msgUsed = usage?.messages_used ?? 0;
  const planLimit =
    subQ.data?.included_messages && subQ.data.included_messages > 0
      ? subQ.data.included_messages
      : DEFAULT_MESSAGE_LIMIT;
  const msgLimit =
    usage?.messages_limit && usage.messages_limit > 0 ? usage.messages_limit : planLimit;
  const pct = msgLimit > 0 ? Math.round((msgUsed / msgLimit) * 100) : 0;

  const periodLabel = formatPeriodMonth(usage?.period_month || currentPeriodMonth());

  return (
    <div>
      <PageHeader title="Uso mensual" subtitle="Consulta tu consumo de respuestas IA del mes." />

      <UsageAlert used={msgUsed} limit={msgLimit} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Respuestas IA usadas este mes" value={`${msgUsed} / ${msgLimit}`}>
          <div className="mt-3">
            <ProgressBar
              value={msgUsed}
              max={msgLimit}
              tone={pct >= 100 ? "danger" : pct >= 80 ? "warning" : "primary"}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Este contador corresponde al uso incluido en tu plan.
          </div>
        </StatCard>
        <StatCard label="Periodo actual" value={periodLabel}>
          <div className="text-xs text-muted-foreground mt-1">
            El contador se reinicia automáticamente cada mes. Tus clientes y conversaciones se mantienen.
          </div>
        </StatCard>
      </div>

      <div className="mt-4 rounded-lg border bg-white p-4 text-sm text-muted-foreground">
        Los costos de WhatsApp Cloud API son cobrados directamente por Meta y no están incluidos en este contador.
      </div>
    </div>
  );
}
