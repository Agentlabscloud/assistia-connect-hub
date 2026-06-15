import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState } from "@/components/ui-bits";
import type { Assistant, UsageCounter, WhatsappAccount } from "@/lib/types";
import { AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";

export const Route = createFileRoute("/_app/notificaciones")({
  component: NotificationsPage,
});

type Tone = "warning" | "danger" | "info";
interface Notif {
  tone: Tone;
  title: string;
  detail?: string;
}

function NotificationsPage() {
  const { companyId, company } = useCompany();

  const aQ = useQuery({
    queryKey: ["assistant", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("assistants").select("*").eq("company_id", companyId).maybeSingle();
      return (data as Assistant) ?? null;
    },
  });
  const waQ = useQuery({
    queryKey: ["wa", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_accounts").select("*").eq("company_id", companyId).maybeSingle();
      return (data as WhatsappAccount) ?? null;
    },
  });
  const uQ = useQuery({
    queryKey: ["usage", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("usage_counters")
        .select("*")
        .eq("company_id", companyId)
        .order("period_start", { ascending: false })
        .limit(1);
      return ((data?.[0] as UsageCounter) ?? null);
    },
  });

  if (aQ.isLoading || waQ.isLoading || uQ.isLoading) return <LoadingState />;

  const notifs: Notif[] = [];
  const wa = waQ.data;
  const usage = uQ.data;
  const a = aQ.data;

  if (wa?.status === "pending") notifs.push({ tone: "warning", title: "Tu WhatsApp está pendiente por conectar." });
  if (wa?.status === "failed")
    notifs.push({ tone: "danger", title: "Hay un error en la conexión de WhatsApp.", detail: wa.connection_error ?? undefined });

  const limit = usage?.messages_limit ?? 0;
  const used = usage?.messages_used ?? 0;
  if (limit > 0 && used >= limit) notifs.push({ tone: "danger", title: "Tu cuenta alcanzó el límite mensual de respuestas." });
  else if (limit > 0 && used / limit > 0.8) notifs.push({ tone: "warning", title: "Tu cuenta está cerca del límite mensual de respuestas." });

  if (a?.status === "draft") notifs.push({ tone: "info", title: "Assistia todavía está en configuración." });
  if (company?.onboarding_status === "pending")
    notifs.push({ tone: "info", title: "Completa el onboarding para dejar tu cuenta lista." });

  return (
    <div>
      <PageHeader title="Notificaciones" subtitle="Alertas importantes sobre tu cuenta y operación." />

      {notifs.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8 text-[color:var(--success)]" />}
          title="Todo está funcionando correctamente."
        />
      ) : (
        <div className="space-y-3">
          {notifs.map((n, i) => (
            <NotifCard key={i} notif={n} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotifCard({ notif }: { notif: Notif }) {
  const Icon = notif.tone === "danger" ? AlertTriangle : notif.tone === "warning" ? Bell : Info;
  const tone =
    notif.tone === "danger"
      ? "bg-[color:var(--destructive)]/10 border-[color:var(--destructive)]/30 text-[color:var(--destructive)]"
      : notif.tone === "warning"
      ? "bg-[color:var(--warning)]/20 border-[color:var(--warning)]/40 text-[color:var(--warning-foreground)]"
      : "bg-white border";
  return (
    <div className={`rounded-lg border p-4 flex gap-3 ${tone}`}>
      <Icon className="h-5 w-5 mt-0.5 shrink-0" />
      <div>
        <div className="font-medium text-sm">{notif.title}</div>
        {notif.detail && <div className="text-xs mt-1 opacity-80">{notif.detail}</div>}
      </div>
    </div>
  );
}
