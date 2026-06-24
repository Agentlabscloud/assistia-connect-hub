import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, StatCard, ProgressBar } from "@/components/ui-bits";
import type { Subscription, UsageCounter } from "@/lib/types";
import { DEFAULT_MESSAGE_LIMIT, SUPPORT_WHATSAPP_URL } from "@/lib/types";
import { Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tStatus, currentPeriodMonth } from "@/lib/i18n";

export const Route = createFileRoute("/_app/billing")({
  component: BillingPage,
});

const FEATURES = [
  "Hasta 5.000 respuestas generadas por IA al mes",
  "1 WhatsApp",
  "1 asistente IA",
  "7 días de optimización",
  "Costos de WhatsApp Cloud API asumidos por el cliente directamente con Meta",
];

function fmtDate(s?: string | null) {
  if (!s) return "No disponible";
  return new Date(s).toLocaleDateString("es");
}

function SupportButton({ className = "" }: { className?: string }) {
  return (
    <Button asChild className={className}>
      <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-4 w-4 mr-2" />
        Contactar soporte
      </a>
    </Button>
  );
}

function BillingPage() {
  const { companyId } = useCompany();

  const subQ = useQuery({
    queryKey: ["sub", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id,company_id,plan_name,included_messages,billing_status,current_period_start,current_period_end")
        .eq("company_id", companyId)
        .maybeSingle();
      return (data as Subscription) ?? null;
    },
  });

  const usageQ = useQuery({
    queryKey: ["usage-current", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("usage_counters")
        .select("id,messages_used,messages_limit,period_month")
        .eq("company_id", companyId)
        .eq("period_month", currentPeriodMonth())
        .maybeSingle();
      return (data as UsageCounter) ?? null;
    },
  });

  if (subQ.isLoading) return <LoadingState />;

  const data = subQ.data;
  const usage = usageQ.data;
  const planLimit =
    usage?.messages_limit && usage.messages_limit > 0
      ? usage.messages_limit
      : data?.included_messages && data.included_messages > 0
        ? data.included_messages
        : DEFAULT_MESSAGE_LIMIT;
  const used = usage?.messages_used ?? 0;
  const pct = planLimit > 0 ? Math.round((used / planLimit) * 100) : 0;
  const hasRealUsage = !!usage;

  return (
    <div>
      <PageHeader title="Plan" subtitle="Consulta tu plan y estado de suscripción." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border rounded-xl shadow-sm p-5 sm:p-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan actual</div>
              <h2 className="text-2xl font-semibold mt-1">
                {data?.plan_name || "Premium"}
              </h2>
            </div>
            <div className="hidden sm:block">
              <SupportButton />
            </div>
          </div>

          <ul className="mt-6 space-y-2 text-sm">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 text-[color:var(--brand-green)] shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {hasRealUsage && (
            <div className="mt-6 border-t pt-4">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-sm font-medium">Uso del periodo</div>
                <div className="text-sm text-muted-foreground">
                  {used} de {planLimit} respuestas usadas ({pct} %)
                </div>
              </div>
              <ProgressBar value={used} max={planLimit} tone={pct >= 100 ? "danger" : pct >= 80 ? "warning" : "primary"} />
            </div>
          )}

          <div className="sm:hidden mt-5">
            <SupportButton className="w-full min-h-[44px]" />
          </div>
        </div>

        <div className="space-y-3">
          <StatCard label="Estado de facturación" value={tStatus(data?.billing_status) || "No disponible"} />
          <StatCard
            label="Respuestas IA incluidas"
            value={data?.included_messages ? `${data.included_messages}` : "5.000"}
          />
          <StatCard label="Inicio del periodo" value={fmtDate(data?.current_period_start)} />
          <StatCard label="Fin del periodo" value={fmtDate(data?.current_period_end)} />
        </div>
      </div>
    </div>
  );
}
