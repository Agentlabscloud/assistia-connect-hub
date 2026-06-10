import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, N8N_TEST_META_WEBHOOK } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import type { WhatsappAccount } from "@/lib/types";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/whatsapp")({
  component: WhatsappPage,
});

const ERROR_HELP: Record<string, string> = {
  token_check: "Revisa que el token esté vigente y que lo hayas copiado sin la palabra Bearer.",
  phone_number_id_check: "Revisa el Phone Number ID en Meta WhatsApp Manager.",
  waba_id_check: "Revisa el WhatsApp Business Account ID.",
  phone_waba_match: "El número no pertenece al WABA enviado.",
};

function WhatsappPage() {
  const { companyId } = useCompany();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["wa", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_accounts").select("*").eq("company_id", companyId).maybeSingle();
      return (data as WhatsappAccount) ?? null;
    },
  });

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; phone_number?: string; verified_name?: string; quality_rating?: string }
    | { ok: false; message?: string; error_step?: string; error_code?: string }
    | null
  >(null);

  useEffect(() => {
    if (data) {
      setPhoneNumberId(data.phone_number_id ?? "");
      setWabaId(data.whatsapp_business_account_id ?? "");
    }
  }, [data]);

  const onTest = async () => {
    if (!data?.id) {
      toast.error("No existe la cuenta de WhatsApp.");
      return;
    }
    if (!phoneNumberId || !wabaId || !accessToken) {
      toast.error("Completa los 3 campos para probar.");
      return;
    }
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch(N8N_TEST_META_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsapp_account_id: data.id,
          company_id: companyId,
          phone_number_id: phoneNumberId,
          whatsapp_business_account_id: wabaId,
          access_token: accessToken,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (json?.success === true) {
        setResult({
          ok: true,
          phone_number: json.phone_number,
          verified_name: json.verified_name,
          quality_rating: json.quality_rating,
        });
        toast.success("WhatsApp conectado correctamente.");
      } else {
        setResult({
          ok: false,
          message: json.message,
          error_step: json.error_step,
          error_code: json.error_code,
        });
        toast.error(json.message || "No se pudo conectar.");
      }
    } catch {
      toast.error("No pudimos conectar con el servicio de validación. Intenta nuevamente o contacta soporte.");
      setResult({ ok: false, message: "Servicio no disponible." });
    } finally {
      setTesting(false);
      setAccessToken("");
      qc.invalidateQueries({ queryKey: ["wa", companyId] });
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Conecta WhatsApp" subtitle="Valida tu conexión con WhatsApp Cloud API." />

      <div className="bg-white rounded-xl border shadow-sm p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div>
            <div className="text-sm text-muted-foreground">Estado actual</div>
            <div className="mt-1">
              <StatusBadge status={data?.status ?? "pending"}>
                {data?.status === "connected" ? "Conectado" : data?.status === "failed" ? "Error" : "Pendiente"}
              </StatusBadge>
            </div>
          </div>
          {data?.verified_name && (
            <div className="text-sm text-right">
              <div className="font-medium">{data.verified_name}</div>
              <div className="text-muted-foreground">{data.phone_number}</div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="pnid">Phone Number ID</Label>
            <Input id="pnid" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="waba">WhatsApp Business Account ID</Label>
            <Input id="waba" value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tok">Access Token</Label>
            <Input id="tok" type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Solo se usa para probar, no se guarda." />
            <p className="text-xs text-muted-foreground mt-1">
              Por seguridad, el Access Token no se almacena. Solo se envía al servicio de validación.
            </p>
          </div>

          <Button onClick={onTest} disabled={testing}>
            {testing ? "Probando…" : "Probar conexión"}
          </Button>
        </div>

        {result?.ok === true && (
          <div className="mt-6 rounded-lg border p-4 bg-[color:var(--success)]/10 border-[color:var(--success)]/30">
            <div className="flex items-center gap-2 text-[color:var(--success)] font-medium">
              <CheckCircle2 className="h-4 w-4" /> WhatsApp conectado correctamente.
            </div>
            <div className="mt-2 text-sm text-foreground/80">
              {result.phone_number && <div>Número: {result.phone_number}</div>}
              {result.verified_name && <div>Nombre verificado: {result.verified_name}</div>}
              {result.quality_rating && <div>Calidad: {result.quality_rating}</div>}
            </div>
          </div>
        )}

        {result?.ok === false && (
          <div className="mt-6 rounded-lg border p-4 bg-[color:var(--destructive)]/10 border-[color:var(--destructive)]/30">
            <div className="flex items-center gap-2 text-[color:var(--destructive)] font-medium">
              <AlertTriangle className="h-4 w-4" /> {result.message || "Error de conexión."}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {result.error_step && <div>Paso: {result.error_step}</div>}
              {result.error_code && <div>Código: {result.error_code}</div>}
            </div>
            {result.error_step && ERROR_HELP[result.error_step] && (
              <div className="mt-2 text-sm">{ERROR_HELP[result.error_step]}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
