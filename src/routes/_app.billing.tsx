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

function BillingPage() {
  const { companyId } = useCompany();

  const { data, isLoading } = useQuery({
    queryKey: ["sub", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("*").eq("company_id", companyId).maybeSingle();
      return (data as Subscription) ?? null;
    },
  });

  if (isLoading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Billing" subtitle="Consulta tu plan y estado de suscripción." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan MVP</div>
              <h2 className="text-2xl font-semibold mt-1">Assistia MVP</h2>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Setup único</div>
              <div className="text-lg font-semibold">499.000 COP</div>
              <div className="text-sm text-muted-foreground mt-2">Mensualidad</div>
              <div className="text-lg font-semibold">299.000 COP</div>
            </div>
          </div>

          <ul className="mt-6 space-y-2 text-sm">
            {[
              "Hasta 5.000 respuestas generadas por IA al mes",
              "1 WhatsApp",
              "1 asistente IA",
              "7 días de optimización",
              "Costos de WhatsApp Cloud API asumidos por el cliente directamente con Meta",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 text-[color:var(--brand-green)]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <StatCard label="Plan actual" value={data?.plan_name || "MVP"} />
          <StatCard label="Estado" value={data?.status || "—"} />
          <StatCard label="Inicio" value={data?.started_at ? new Date(data.started_at).toLocaleDateString("es") : "—"} />
          <StatCard label="Vencimiento" value={data?.ends_at ? new Date(data.ends_at).toLocaleDateString("es") : "—"} />
          <StatCard label="Límite mensual" value={data?.messages_limit ?? "—"} />
        </div>
      </div>
    </div>
  );
}
