import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, StatusBadge, ProgressBar, LoadingState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL, DEFAULT_MESSAGE_LIMIT } from "@/lib/types";
import type { Assistant, WhatsappAccount, UsageCounter, Subscription } from "@/lib/types";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Bot,
  MessageCircle,
  Users,
  MessagesSquare,
  Gauge,
  CreditCard,
  Settings,
  AlertTriangle,
} from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function currentPeriodMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Dashboard() {
  const { companyId, company } = useCompany();

  const assistantQ = useQuery({
    queryKey: ["assistant", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("assistants")
        .select("id,name,product_name,business_description,tone,fallback_message,handoff_phone,assistant_type,status")
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
        .select("id,company_id,assistant_id,phone_number,phone_number_id,whatsapp_business_account_id,status,webhook_status")
        .eq("company_id", companyId)
        .maybeSingle();
      return (data as WhatsappAccount) ?? null;
    },
  });

  const usageQ = useQuery({
    queryKey: ["usage", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const month = currentPeriodMonth();
      const { data: cur } = await supabase
        .from("usage_counters")
        .select("id,company_id,period_month,messages_used,messages_limit")
        .eq("company_id", companyId)
        .eq("period_month", month)
        .maybeSingle();
      if (cur) return cur as UsageCounter;
      const { data: latest } = await supabase
        .from("usage_counters")
        .select("id,company_id,period_month,messages_used,messages_limit")
        .eq("company_id", companyId)
        .order("period_month", { ascending: false })
        .limit(1);
      return (latest?.[0] as UsageCounter) ?? null;
    },
  });

  const contactsCountQ = useQuery({
    queryKey: ["contacts-count", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { count } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      return count ?? 0;
    },
  });

  const openConvQ = useQuery({
    queryKey: ["open-conv-count", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { count } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "open");
      return count ?? 0;
    },
  });

  const subQ = useQuery({
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

  const loading =
    assistantQ.isLoading || waQ.isLoading || usageQ.isLoading || contactsCountQ.isLoading || openConvQ.isLoading;

  if (loading) return <LoadingState />;

  const assistant = assistantQ.data;
  const wa = waQ.data;
  const usage = usageQ.data;
  const sub = subQ.data;

  const step1Done = !!(assistant?.business_description && assistant?.tone && assistant?.fallback_message);
  const step2Done = wa?.status === "connected";
  const step3Done = step2Done;
  const stepsDone = [step1Done, step2Done, step3Done].filter(Boolean).length;

  const assistantStatusLabel = assistant?.status === "active" ? "Activo" : "En configuración";
  const waLabel = wa?.status === "connected" ? "Conectado" : wa?.status === "failed" ? "Error" : "Pendiente";

  const msgUsed = usage?.messages_used ?? 0;
  const msgLimit = usage?.messages_limit && usage.messages_limit > 0
    ? usage.messages_limit
    : sub?.included_messages && sub.included_messages > 0
      ? sub.included_messages
      : DEFAULT_MESSAGE_LIMIT;
  const msgPct = msgLimit > 0 ? (msgUsed / msgLimit) * 100 : 0;

  return (
    <div>
      <PageHeader title="Bienvenido a Assistia" subtitle="Atiende, responde y vende por WhatsApp con IA." />

      <UsageAlert used={msgUsed} limit={msgLimit} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <LinkCard to="/assistia" icon={<Bot className="h-5 w-5" />} label="Estado de Assistia">
          <StatusBadge status={assistant?.status === "active" ? "active" : "draft"}>{assistantStatusLabel}</StatusBadge>
        </LinkCard>
        <LinkCard to="/whatsapp" icon={<MessageCircle className="h-5 w-5" />} label="Estado de WhatsApp">
          <StatusBadge status={wa?.status ?? "pending"}>{waLabel}</StatusBadge>
        </LinkCard>
        <LinkCard to="/clientes" icon={<Users className="h-5 w-5" />} label="Clientes registrados">
          <div className="text-2xl font-semibold">{contactsCountQ.data ?? 0}</div>
        </LinkCard>
        <LinkCard to="/conversaciones" icon={<MessagesSquare className="h-5 w-5" />} label="Conversaciones abiertas">
          <div className="text-2xl font-semibold">{openConvQ.data ?? 0}</div>
        </LinkCard>

        <LinkCard
          to="/uso-mensual"
          icon={<Gauge className="h-5 w-5" />}
          label="Respuestas IA usadas este mes"
          className="sm:col-span-2"
        >
          <div className="text-2xl font-semibold">
            {msgUsed}
            <span className="text-sm text-muted-foreground"> / {msgLimit}</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={msgUsed} max={msgLimit} tone={msgPct >= 100 ? "danger" : msgPct >= 80 ? "warning" : "primary"} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Este contador corresponde al uso incluido en tu plan de AgentLabs Cloud.
          </div>
        </LinkCard>

        <LinkCard to="/billing" icon={<CreditCard className="h-5 w-5" />} label="Plan actual">
          <div className="text-lg font-semibold">Premium</div>
        </LinkCard>
        <LinkCard to="/configuracion" icon={<Settings className="h-5 w-5" />} label="Onboarding">
          <StatusBadge status={company?.onboarding_status ?? "pending"}>
            {company?.onboarding_status ?? "pendiente"}
          </StatusBadge>
        </LinkCard>
      </div>

      <div className="mt-8 bg-white rounded-xl border shadow-sm p-5 sm:p-6">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold">Configura Assistia en 3 pasos</h2>
            <p className="text-sm text-muted-foreground">
              {stepsDone === 3
                ? "Assistia está lista para operar."
                : "Completa estos pasos para dejar Assistia lista para atender clientes."}
            </p>
          </div>
          <div className="text-sm font-medium">{stepsDone}/3</div>
        </div>
        <div className="mt-3">
          <ProgressBar value={stepsDone} max={3} />
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <OnboardingStep
            done={step1Done}
            title="Configura Assistia"
            description="Define cómo debe responder tu asistente."
            to="/assistia"
            cta="Ir a Assistia"
          />
          <OnboardingStep
            done={step2Done}
            title="Conecta WhatsApp"
            description="Valida la conexión con WhatsApp Cloud API."
            to="/whatsapp"
            cta="Ir a WhatsApp"
          />
          <OnboardingStep
            done={step3Done}
            title="Prueba tu asistente"
            description={step2Done ? "Listo para prueba real desde WhatsApp." : "Disponible cuando WhatsApp esté conectado."}
            to="/whatsapp"
            cta="Ir a WhatsApp"
          />
        </div>
      </div>
    </div>
  );
}

function LinkCard({
  to,
  label,
  icon,
  children,
  className,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`group rounded-xl border bg-white p-5 shadow-sm hover:shadow-md hover:border-[color:var(--brand-green)]/40 transition-all ${className ?? ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-muted-foreground group-hover:text-foreground">{icon}</div>
      </div>
      <div className="mt-2">{children}</div>
    </Link>
  );
}

export function UsageAlert({ used, limit }: { used: number; limit: number }) {
  if (limit <= 0) return null;
  const pct = (used / limit) * 100;
  if (pct < 80) return null;
  const critical = used >= limit;
  const subject = critical
    ? "Limite%20de%20respuestas%20IA%20alcanzado"
    : "Ampliar%20limite%20de%20respuestas%20IA";
  const message = critical
    ? "Ya usaste todas las respuestas IA incluidas este mes. Contacta soporte para ampliar tu límite o revisar tu plan."
    : "Estás cerca de alcanzar el límite de respuestas IA incluidas en tu plan.";
  const tone = critical
    ? "bg-[color:var(--destructive)]/10 border-[color:var(--destructive)]/30 text-[color:var(--destructive)]"
    : "bg-[color:var(--warning)]/20 border-[color:var(--warning)]/40 text-[color:var(--warning-foreground)]";
  return (
    <div className={`mb-5 rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${tone}`}>
      <div className="flex items-start gap-2 flex-1">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
        <span className="text-sm">{message}</span>
      </div>
      <Button asChild size="sm" variant={critical ? "destructive" : "default"}>
        <a href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}>Contactar soporte</a>
      </Button>
    </div>
  );
}

function OnboardingStep({
  done,
  title,
  description,
  to,
  cta,
}: {
  done: boolean;
  title: string;
  description: string;
  to: "/assistia" | "/whatsapp";
  cta: string;
}) {
  return (
    <div className="rounded-lg border bg-[color:var(--brand-ivory)] p-4 flex flex-col">
      <div className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-[color:var(--success)]" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
        <div className="font-medium text-sm">{title}</div>
      </div>
      <p className="text-sm text-muted-foreground mt-2 flex-1">{description}</p>
      <Link to={to} className="mt-3">
        <Button size="sm" variant={done ? "outline" : "default"} className="w-full sm:w-auto">
          {cta} <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </Link>
    </div>
  );
}
