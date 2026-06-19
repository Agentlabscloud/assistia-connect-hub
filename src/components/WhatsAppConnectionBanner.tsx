import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function WhatsAppConnectionBanner() {
  const { companyId } = useCompany();

  const waQ = useQuery({
    queryKey: ["wa-banner", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_accounts")
        .select("status,connection_error,webhook_status")
        .eq("company_id", companyId)
        .maybeSingle();
      return data as { status: string | null; connection_error: string | null; webhook_status: string | null } | null;
    },
  });

  const wa = waQ.data;
  if (!wa) return null;

  const connected = wa.status === "connected" || wa.webhook_status === "connected";
  const hasError = !!wa.connection_error;

  if (connected && !hasError) return null;

  const message = hasError
    ? "Hay un problema temporal con la conexión de WhatsApp. Estamos trabajando para solucionarlo."
    : "WhatsApp no está conectado correctamente. Algunas respuestas pueden demorarse. Estamos revisando la conexión.";

  return (
    <div className="mb-4 rounded-lg border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)] p-3 flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 text-sm">
        {message}{" "}
        <Link to="/whatsapp" className="underline font-medium">
          Revisar conexión
        </Link>
      </div>
    </div>
  );
}
