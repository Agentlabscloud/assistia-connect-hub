import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, StatCard } from "@/components/ui-bits";
import type { Subscription } from "@/lib/types";
import { Check } from "lucide-react";

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

function BillingPage() {
  const { companyId } = useCompany();

  const { data, isLoading } = useQuery({
    queryKey: ["sub", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id,company_id,plan_name,setup_fee_cop,monthly_fee_cop,included_messages,billing_status,current_period_start,current_period_end")
        .eq("company_id", companyId)
        .maybeSingle();
      return (data as Subscription) ?? null;
    },
  });

  if (isLoading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Plan" subtitle="Consulta tu plan y estado de suscripción." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border rounded-xl shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan actual</div>
              <h2 className="text-2xl font-semibold mt-1">Premium</h2>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Setup único</div>
              <div className="text-lg font-semibold">599.000 COP</div>
              <div className="text-sm text-muted-foreground mt-2">Mensualidad</div>
              <div className="text-lg font-semibold">399.000 COP</div>
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
        </div>

        <div className="space-y-3">
          <StatCard label="Estado de facturación" value={data?.billing_status || "No disponible"} />
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
