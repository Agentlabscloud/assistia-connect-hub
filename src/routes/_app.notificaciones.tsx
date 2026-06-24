import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP_URL, DEFAULT_MESSAGE_LIMIT } from "@/lib/types";
import type { Assistant, UsageCounter, WhatsappAccount, Subscription } from "@/lib/types";
import { AlertTriangle, Bell, CheckCircle2, Info, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_app/notificaciones")({
  component: NotificationsPage,
});

type Tone = "warning" | "danger" | "info";
interface Notif {
  tone: Tone;
  title: string;
  detail?: string;
  action?: { label: string; href: string };
}

const supportAction = (subject: string) => ({
  label: "Contactar soporte",
  href: `mailto:${SUPPORT_EMAIL}?subject=${subject}`,
});

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function NotificationsPage() {
  const { companyId, company } = useCompany();

  const aQ = useQuery({
    queryKey: ["assistant", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("assistants")
        .select("id,status")
        .eq("company_id", companyId)
        .maybeSingle();
      return (data as Assistant) ?? null;
    },
  });
  const waQ = useQuery({
    queryKey: ["wa", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_accounts")
        .select("id,status,webhook_status")
        .eq("company_id", companyId)
        .maybeSingle();
      return (data as WhatsappAccount) ?? null;
    },
  });
  const uQ = useQuery({
    queryKey: ["usage", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const m = currentMonth();
      const { data } = await supabase
        .from("usage_counters")
        .select("id,messages_used,messages_limit,period_month")
        .eq("company_id", companyId)
        .eq("period_month", m)
        .maybeSingle();
      if (data) return data as UsageCounter;
      const { data: latest } = await supabase
        .from("usage_counters")
        .select("id,messages_used,messages_limit,period_month")
        .eq("company_id", companyId)
        .order("period_month", { ascending: false })
        .limit(1);
      return (latest?.[0] as UsageCounter) ?? null;
    },
  });
  const sQ = useQuery({
    queryKey: ["sub", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id,billing_status,current_period_end,included_messages")
        .eq("company_id", companyId)
        .maybeSingle();
      return (data as Subscription) ?? null;
    },
  });

  if (aQ.isLoading || waQ.isLoading || uQ.isLoading || sQ.isLoading) return <LoadingState />;

  const notifs: Notif[] = [];
  const wa = waQ.data;
  const usage = uQ.data;
  const a = aQ.data;
  const sub = sQ.data;

  if (a?.status !== "active") notifs.push({ tone: "info", title: "Assistia todavía está en configuración." });
  if (wa?.status !== "connected") notifs.push({ tone: "warning", title: "WhatsApp pendiente de conexión." });
  if (company?.onboarding_status && company.onboarding_status !== "completed")
    notifs.push({ tone: "info", title: "Completa el onboarding para dejar tu cuenta lista." });

  const limit = (usage?.messages_limit && usage.messages_limit > 0)
    ? usage.messages_limit
    : sub?.included_messages && sub.included_messages > 0
      ? sub.included_messages
      : DEFAULT_MESSAGE_LIMIT;
  const used = usage?.messages_used ?? 0;
  if (limit > 0 && used >= limit) {
    notifs.push({
      tone: "danger",
      title: "Alcanzaste el límite de respuestas IA del mes.",
      action: supportAction("Limite%20de%20respuestas%20IA%20alcanzado"),
    });
  } else if (limit > 0 && used / limit >= 0.8) {
    notifs.push({
      tone: "warning",
      title: "Te acercas al límite de respuestas IA del mes.",
      action: supportAction("Ampliar%20limite%20de%20respuestas%20IA"),
    });
  }

  if (sub?.billing_status && ["pending", "past_due", "unpaid"].includes(sub.billing_status)) {
    notifs.push({
      tone: "danger",
      title: "Tu pago está pendiente.",
      action: supportAction("Pago%20pendiente"),
    });
  }

  if (sub?.current_period_end) {
    const ends = new Date(sub.current_period_end).getTime();
    const days = Math.ceil((ends - Date.now()) / (1000 * 60 * 60 * 24));
    if (days > 0 && days <= 7) {
      notifs.push({ tone: "info", title: `Tu periodo vence en ${days} día${days === 1 ? "" : "s"}.` });
    }
  }

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
    <div className={`rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${tone}`}>
      <div className="flex gap-3 flex-1">
        <Icon className="h-5 w-5 mt-0.5 shrink-0" />
        <div>
          <div className="font-medium text-sm">{notif.title}</div>
          {notif.detail && <div className="text-xs mt-1 opacity-80">{notif.detail}</div>}
        </div>
      </div>
      {notif.action && (
        <Button asChild size="sm" variant={notif.tone === "danger" ? "destructive" : "default"}>
          <a href={notif.action.href}>{notif.action.label}</a>
        </Button>
      )}
    </div>
  );
}
