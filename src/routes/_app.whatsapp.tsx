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

const WA_COLUMNS =
  "id,company_id,assistant_id,phone_number,phone_number_id,whatsapp_business_account_id,meta_business_id,status,webhook_status";

const ERROR_HELP: Record<string, string> = {
  token_check: "Revisa que el token esté vigente y que lo hayas copiado correctamente.",
  phone_number_id_check: "Revisa el Phone Number ID en Meta WhatsApp Manager.",
  waba_id_check: "Revisa el WhatsApp Business Account ID (WABA ID).",
  phone_waba_match: "El número no pertenece al WABA ID enviado.",
};

function genVerifyToken() {
  return (
    "asistia_" +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function WhatsappPage() {
  const { companyId } = useCompany();
  const qc = useQueryClient();

  const { data: assistant } = useQuery({
    queryKey: ["assistant-id", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("assistants")
        .select("id")
        .eq("company_id", companyId)
        .maybeSingle();
      return (data as { id: string } | null) ?? null;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["wa", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_accounts")
        .select(WA_COLUMNS)
        .eq("company_id", companyId)
        .maybeSingle();
      return (data as WhatsappAccount) ?? null;
    },
  });

  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [metaBusinessId, setMetaBusinessId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; phone_number?: string; verified_name?: string; quality_rating?: string }
    | { ok: false; message?: string; error_step?: string; error_code?: string }
    | null
  >(null);

  useEffect(() => {
    if (data) {
      setPhoneNumber(data.phone_number ?? "");
      setPhoneNumberId(data.phone_number_id ?? "");
      setWabaId(data.whatsapp_business_account_id ?? "");
      setMetaBusinessId(data.meta_business_id ?? "");
    }
  }, [data]);

  const saveAccount = async (): Promise<WhatsappAccount> => {
    if (!companyId) throw new Error("No se pudo identificar tu empresa.");
    const assistantId = assistant?.id ?? data?.assistant_id ?? null;

    const vt = verifyToken.trim() || genVerifyToken();
    const payload = {
      company_id: companyId,
      assistant_id: assistantId,
      phone_number: phoneNumber.trim() || null,
      phone_number_id: phoneNumberId.trim(),
      whatsapp_business_account_id: wabaId.trim(),
      meta_business_id: metaBusinessId.trim() || null,
      verify_token: vt,
      status: "pending",
      webhook_status: "pending",
      connection_step: "configured",
      connection_error: null,
      connection_error_code: null,
      connection_error_details: null,
    };

    if (data?.id) {
      const { data: updated, error } = await supabase
        .from("whatsapp_accounts")
        .update(payload)
        .eq("id", data.id)
        .eq("company_id", companyId)
        .select(WA_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      return updated as WhatsappAccount;
    }

    const { data: inserted, error } = await supabase
      .from("whatsapp_accounts")
      .insert(payload)
      .select(WA_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    return inserted as WhatsappAccount;
  };

  const onSubmit = async (mode: "save" | "test") => {
    if (!phoneNumberId.trim() || !wabaId.trim()) {
      toast.error("Completa Phone Number ID y WABA ID.");
      return;
    }
    if (mode === "test" && !accessToken.trim()) {
      toast.error("Ingresa el Access Token para probar la conexión.");
      return;
    }
    setSubmitting(true);
    setResult(null);

    let saved: WhatsappAccount;
    try {
      saved = await saveAccount();
      qc.invalidateQueries({ queryKey: ["wa", companyId] });
      if (mode === "save") {
        toast.success("Datos de WhatsApp guardados.");
        setSubmitting(false);
        return;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error("No se pudo guardar la cuenta de WhatsApp. Revisa los datos e intenta nuevamente.", {
        description: msg,
      });
      setSubmitting(false);
      return;
    }

    if (!N8N_TEST_META_WEBHOOK) {
      toast.error("Falta configurar el webhook de prueba.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(N8N_TEST_META_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          assistant_id: saved.assistant_id ?? null,
          whatsapp_account_id: saved.id,
          phone_number: saved.phone_number,
          phone_number_id: saved.phone_number_id,
          whatsapp_business_account_id: saved.whatsapp_business_account_id,
          meta_business_id: saved.meta_business_id ?? null,
          verify_token: verifyToken.trim() || undefined,
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Servicio no disponible.";
      toast.error("No pudimos conectar con el servicio de validación.", { description: msg });
      setResult({ ok: false, message: msg });
    } finally {
      setAccessToken("");
      setSubmitting(false);
      qc.invalidateQueries({ queryKey: ["wa", companyId] });
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Conecta WhatsApp" subtitle="Valida tu conexión con WhatsApp Cloud API." />

      <div className="bg-white rounded-xl border shadow-sm p-5 sm:p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div>
            <div className="text-sm text-muted-foreground">Estado actual</div>
            <div className="mt-1">
              <StatusBadge status={data?.status ?? "pending"}>
                {data?.status === "connected"
                  ? "Conectado"
                  : data?.status === "failed"
                  ? "Error"
                  : "Pendiente"}
              </StatusBadge>
            </div>
          </div>
          {data?.phone_number && (
            <div className="text-sm text-right">
              <div className="text-muted-foreground">{data.phone_number}</div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="pn">Número de WhatsApp</Label>
            <Input
              id="pn"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+57 300 000 0000"
            />
          </div>
          <div>
            <Label htmlFor="pnid">Phone Number ID</Label>
            <Input id="pnid" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="waba">WABA ID (WhatsApp Business Account ID)</Label>
            <Input id="waba" value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="mbid">Meta Business ID (opcional)</Label>
            <Input id="mbid" value={metaBusinessId} onChange={(e) => setMetaBusinessId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="vt">Verify Token (opcional)</Label>
            <Input
              id="vt"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              placeholder="Se generará automáticamente si lo dejas vacío"
            />
          </div>
          <div>
            <Label htmlFor="tok">Access Token</Label>
            <Input
              id="tok"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Solo se usa para probar, no se guarda."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Por seguridad, el Access Token no se almacena. Solo se envía al servicio de validación.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onSubmit("save")} disabled={submitting} variant="outline">
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
            <Button onClick={() => onSubmit("test")} disabled={submitting}>
              {submitting ? "Probando…" : "Guardar y probar conexión"}
            </Button>
          </div>
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
