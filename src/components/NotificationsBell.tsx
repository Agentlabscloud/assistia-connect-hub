import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { DEFAULT_MESSAGE_LIMIT, SUPPORT_WHATSAPP_URL } from "@/lib/types";
import type { UsageCounter, Subscription } from "@/lib/types";
import { currentPeriodMonth } from "@/lib/i18n";

type Alert = {
  id: string;
  tone: "info" | "warning" | "danger";
  title: string;
  to?: "/billing" | "/uso-mensual";
};

function useAlerts(): { alerts: Alert[]; loading: boolean } {
  const { companyId } = useCompany();

  const subQ = useQuery({
    queryKey: ["sub-bell", companyId],
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
  const usageQ = useQuery({
    queryKey: ["usage-bell", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const m = currentPeriodMonth();
      const { data } = await supabase
        .from("usage_counters")
        .select("id,messages_used,messages_limit,period_month")
        .eq("company_id", companyId)
        .eq("period_month", m)
        .maybeSingle();
      return (data as UsageCounter) ?? null;
    },
  });

  const alerts: Alert[] = [];
  const sub = subQ.data;
  if (sub?.current_period_end) {
    const ends = new Date(sub.current_period_end).getTime();
    if (!isNaN(ends)) {
      const days = Math.ceil((ends - Date.now()) / (1000 * 60 * 60 * 24));
      if (days <= 3 && days >= 0) {
        const isTrial =
          (sub.billing_status || "").toLowerCase().includes("trial") ||
          (sub.billing_status || "").toLowerCase() === "trialing";
        alerts.push({
          id: "period-end",
          tone: "warning",
          title: isTrial
            ? "Tu periodo de prueba termina pronto. Revisa tu plan o contacta a soporte."
            : `Tu próximo periodo vence en ${days} día${days === 1 ? "" : "s"}. Contacta a soporte para coordinar tu pago.`,
          to: "/billing",
        });
      }
    }
  }

  const usage = usageQ.data;
  const limit = usage?.messages_limit && usage.messages_limit > 0
    ? usage.messages_limit
    : sub?.included_messages && sub.included_messages > 0
      ? sub.included_messages
      : DEFAULT_MESSAGE_LIMIT;
  const used = usage?.messages_used ?? 0;
  if (usage && limit > 0) {
    const pct = (used / limit) * 100;
    if (pct >= 95) {
      alerts.push({
        id: "usage-critical",
        tone: "danger",
        title: "Te quedan pocas respuestas IA disponibles este periodo.",
        to: "/uso-mensual",
      });
    } else if (pct >= 80) {
      alerts.push({
        id: "usage-warn",
        tone: "warning",
        title: `Has usado el ${Math.round(pct)} % de las respuestas IA incluidas en tu plan.`,
        to: "/uso-mensual",
      });
    }
  }

  return { alerts, loading: subQ.isLoading || usageQ.isLoading };
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { alerts } = useAlerts();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const count = alerts.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-muted"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--destructive)] text-white text-[10px] font-semibold flex items-center justify-center">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b">
            <div className="text-sm font-semibold">Notificaciones</div>
          </div>
          {count === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              No tienes alertas activas.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y">
              {alerts.map((a) => (
                <li key={a.id}>
                  {a.to ? (
                    <Link
                      to={a.to}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 hover:bg-muted/50"
                    >
                      <AlertContent alert={a} />
                    </Link>
                  ) : (
                    <div className="px-4 py-3"><AlertContent alert={a} /></div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="border-t flex">
            <Link
              to="/notificaciones"
              onClick={() => setOpen(false)}
              className="flex-1 px-4 py-2.5 text-sm text-[color:var(--brand-blue)] text-center hover:bg-muted/40"
            >
              Ver todas
            </Link>
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2.5 text-sm text-[color:var(--brand-blue)] text-center hover:bg-muted/40 border-l"
            >
              Soporte
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertContent({ alert }: { alert: Alert }) {
  const dot =
    alert.tone === "danger"
      ? "bg-[color:var(--destructive)]"
      : alert.tone === "warning"
        ? "bg-[color:var(--warning)]"
        : "bg-[color:var(--brand-blue)]";
  return (
    <div className="flex gap-2">
      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dot}`} />
      <span className="text-sm leading-snug">{alert.title}</span>
    </div>
  );
}
