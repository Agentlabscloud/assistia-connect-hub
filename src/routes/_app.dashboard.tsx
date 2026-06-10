import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, StatCard, StatusBadge, ProgressBar, LoadingState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import type { Assistant, WhatsappAccount, UsageCounter, Subscription } from "@/lib/types";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { companyId, company } = useCompany();

  const assistantQ = useQuery({
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

  const usageQ = useQuery({
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
        .select("*")
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

  const step1Done = !!(assistant?.business_description && assistant?.system_prompt && assistant?.tone && assistant?.fallback_message);
  const step2Done = wa?.status === "connected";
  const step3Done = step2Done;
  const stepsDone = [step1Done, step2Done, step3Done].filter(Boolean).length;

  const assistantStatusLabel =
    assistant?.status === "active" ? "Activo" : "En configuración";
  const waLabel =
    wa?.status === "connected" ? "Conectado" : wa?.status === "failed" ? "Error" : "Pendiente";

  return (
    <div>
      <PageHeader title="Bienvenido a Assistia" subtitle="Atiende, responde y vende por WhatsApp con IA." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Estado de Assistia" value={<StatusBadge status={assistant?.status === "active" ? "active" : "draft"}>{assistantStatusLabel}</StatusBadge>} />
        <StatCard label="Estado de WhatsApp" value={<StatusBadge status={wa?.status ?? "pending"}>{waLabel}</StatusBadge>} />
        <StatCard label="Clientes registrados" value={contactsCountQ.data ?? 0} />
        <StatCard label="Conversaciones abiertas" value={openConvQ.data ?? 0} />

        <StatCard
          label="Mensajes usados este mes"
          value={
            <span>
              {usage?.messages_used ?? 0}
              <span className="text-sm text-muted-foreground"> / {usage?.messages_limit ?? 0}</span>
            </span>
          }
        >
          <div className="mt-3">
            <ProgressBar value={usage?.messages_used ?? 0} max={usage?.messages_limit ?? 0} />
          </div>
        </StatCard>

        <StatCard
          label="Tokens usados"
          value={
            <span>
              {usage?.tokens_used ?? 0}
              <span className="text-sm text-muted-foreground"> / {usage?.tokens_limit ?? 0}</span>
            </span>
          }
        >
          <div className="mt-3">
            <ProgressBar value={usage?.tokens_used ?? 0} max={usage?.tokens_limit ?? 0} />
          </div>
        </StatCard>

        <StatCard label="Plan actual" value={sub?.plan_name || "MVP"} />
        <StatCard label="Onboarding" value={<StatusBadge status={company?.onboarding_status ?? "pending"}>{company?.onboarding_status ?? "pending"}</StatusBadge>} />
      </div>

      <div className="mt-8 bg-white rounded-xl border shadow-sm p-6">
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
            to="/assistant"
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
            description={step2Done ? "Listo para prueba real desde WhatsApp" : "Disponible cuando WhatsApp esté conectado."}
            to="/whatsapp"
            cta="Ir a WhatsApp"
          />
        </div>
      </div>
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
  to: "/assistant" | "/whatsapp";
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
        <Button size="sm" variant={done ? "outline" : "default"}>
          {cta} <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </Link>
    </div>
  );
}
