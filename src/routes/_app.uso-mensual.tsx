import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, StatCard, ProgressBar } from "@/components/ui-bits";
import type { UsageCounter, Subscription } from "@/lib/types";
import { DEFAULT_MESSAGE_LIMIT } from "@/lib/types";
import { UsageAlert } from "@/routes/_app.dashboard";
import { currentPeriodMonth, formatPeriodMonth, lastNDays, dayKey } from "@/lib/i18n";
import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_app/uso-mensual")({
  component: UsagePage,
});

function UsagePage() {
  const { companyId } = useCompany();
  const [days, setDays] = useState<7 | 30>(7);

  const usageQ = useQuery({
    queryKey: ["usage-current", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const month = currentPeriodMonth();
      const { data } = await supabase
        .from("usage_counters")
        .select("id,company_id,period_month,messages_used,messages_limit")
        .eq("company_id", companyId)
        .eq("period_month", month)
        .maybeSingle();
      return (data as UsageCounter) ?? null;
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

  const rangeStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));
    return d.toISOString();
  }, [days]);

  const messagesQ = useQuery({
    queryKey: ["activity-messages", companyId, days],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("created_at,direction")
        .eq("company_id", companyId)
        .eq("direction", "inbound")
        .gte("created_at", rangeStart);
      if (error) throw error;
      return (data ?? []) as Array<{ created_at: string; direction: string }>;
    },
  });

  const convsQ = useQuery({
    queryKey: ["activity-convs", companyId, days],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("created_at")
        .eq("company_id", companyId)
        .gte("created_at", rangeStart);
      if (error) throw error;
      return (data ?? []) as Array<{ created_at: string }>;
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

      {/* Activity section */}
      <section className="mt-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold">Actividad del periodo</h2>
            <p className="text-sm text-muted-foreground">
              Conoce el volumen de mensajes y conversaciones que recibió tu negocio.
            </p>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 30)}>
            <SelectTrigger className="sm:w-52 min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActivityCard
            title="Mensajes recibidos"
            description="Mensajes que tus clientes enviaron por WhatsApp."
            days={days}
            isLoading={messagesQ.isLoading}
            isError={messagesQ.isError}
            timestamps={(messagesQ.data ?? []).map((m) => m.created_at)}
            emptyText="No recibiste mensajes en este periodo."
            color="var(--brand-blue)"
          />
          <ActivityCard
            title="Nuevas conversaciones"
            description="Personas que iniciaron una conversación contigo."
            days={days}
            isLoading={convsQ.isLoading}
            isError={convsQ.isError}
            timestamps={(convsQ.data ?? []).map((c) => c.created_at)}
            emptyText="No hay conversaciones nuevas en este periodo."
            color="var(--brand-green)"
          />
        </div>
      </section>
    </div>
  );
}

function ActivityCard({
  title,
  description,
  days,
  isLoading,
  isError,
  timestamps,
  emptyText,
  color,
}: {
  title: string;
  description: string;
  days: number;
  isLoading: boolean;
  isError: boolean;
  timestamps: string[];
  emptyText: string;
  color: string;
}) {
  const series = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const t of timestamps) {
      const k = dayKey(t);
      if (!k) continue;
      buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }
    return lastNDays(days).map(({ key, label }) => ({
      label,
      count: buckets.get(key) ?? 0,
    }));
  }, [timestamps, days]);

  const total = series.reduce((s, d) => s + d.count, 0);

  return (
    <div className="rounded-xl border bg-white shadow-sm p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold">{total}</div>
          <div className="text-[11px] text-muted-foreground">total del periodo</div>
        </div>
      </div>
      <div className="mt-4 h-48">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Cargando…</div>
        ) : isError ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            No fue posible cargar esta métrica. Intenta nuevamente.
          </div>
        ) : total === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4">
            {emptyText}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number) => [v, "Cantidad"]}
              />
              <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />

            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
