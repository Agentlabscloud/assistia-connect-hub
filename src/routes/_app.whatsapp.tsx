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
import { AlertTriangle, CheckCircle2, Copy } from "lucide-react";

export const Route = createFileRoute("/_app/whatsapp")({
  component: WhatsappPage,
});

const WA_COLUMNS =
  "id,company_id,assistant_id,phone_number,phone_number_id,whatsapp_business_account_id,meta_business_id,status,webhook_status,verify_token,verified_name,display_phone_number,quality_rating";

const META_CALLBACK_URL = "https://n8n.agentlabs.cloud/webhook/asistia/whatsapp";

const ERROR_HELP: Record<string, string> = {
  token_check: "Revisa que el token esté vigente y que lo hayas copiado correctamente.",
  phone_number_id_check: "Revisa el ID del número de teléfono en Meta WhatsApp Manager.",
  waba_id_check: "Revisa el WABA ID (WhatsApp Business Account ID).",
  phone_waba_match: "El número no pertenece al WABA ID enviado.",
};

function genVerifyToken() {
  return (
    "asistia_" +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

function pick<T = string>(...vals: Array<T | null | undefined>): T | undefined {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v as T;
  return undefined;
}

function qualityLabel(q?: string | null) {
  if (!q) return "Calidad no disponible";
  return `Calidad: ${q.toUpperCase()}`;
}

function webhookStatusLabel(s?: string | null) {
  if (s === "connected" || s === "active") return "Webhook configurado correctamente";
  return "Webhook pendiente de configurar en Meta";
}

function statusLabel(s?: string | null) {
  if (s === "connected") return "WhatsApp conectado correctamente";
  if (s === "failed") return "No se pudo validar la conexión";
  return "Conexión pendiente";
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label}: copiado`);
  } catch {
    toast.error("No se pudo copiar");
  }
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
  const [accessToken, setAccessToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | {
        ok: true;
        phone_number?: string;
        verified_name?: string;
        quality_rating?: string;
        webhook_status?: string;
        status?: string;
      }
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

    const vt = data?.verify_token || genVerifyToken();
    const payload = {
      company_id: companyId,
      assistant_id: assistantId,
      phone_number: phoneNumber.trim() || null,
      phone_number_id: phoneNumberId.trim(),
      whatsapp_business_account_id: wabaId.trim(),
      meta_business_id: metaBusinessId.trim() || null,
      verify_token: vt,
      status: data?.status ?? "pending",
      webhook_status: data?.webhook_status ?? "pending",
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
      toast.error("Completa el ID del número de teléfono y el WABA ID.");
      return;
    }
    if (mode === "test" && !accessToken.trim()) {
      toast.error("Ingresa el Access Token temporal para probar la conexión.");
      return;
    }
    setSubmitting(true);
    setResult(null);

    let saved: WhatsappAccount;
    try {
      saved = await saveAccount();
      qc.invalidateQueries({ queryKey: ["wa", companyId] });
      if (mode === "save") {
        toast.success("Guardado correctamente");
        setSubmitting(false);
        return;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error("Error al guardar. Revisa los datos e intenta nuevamente.", { description: msg });
      setSubmitting(false);
      return;
    }

    if (!N8N_TEST_META_WEBHOOK) {
      toast.error("Falta configurar el servicio de validación.");
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
          verify_token: saved.verify_token,
          access_token: accessToken,
        }),
      });
      const json: Record<string, unknown> = await res.json().catch(() => ({}));
      const nested = (json.whatsapp_account ?? {}) as Record<string, unknown>;
      const g = <T,>(k: string): T | undefined =>
        (nested[k] as T) ?? (json[k] as T) ?? undefined;

      if (json?.success === true) {
        setResult({
          ok: true,
          phone_number: pick(
            g<string>("display_phone_number"),
            g<string>("phone_number"),
          ),
          verified_name: g<string>("verified_name"),
          quality_rating: g<string>("quality_rating"),
          webhook_status: g<string>("webhook_status"),
          status: g<string>("status") ?? "connected",
        });
        toast.success("Conexión validada");
      } else {
        setResult({
          ok: false,
          message: json.message as string | undefined,
          error_step: json.error_step as string | undefined,
          error_code: json.error_code as string | undefined,
        });
        toast.error((json.message as string) || "No se pudo validar la conexión");
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

  const verifyToken = data?.verify_token ?? "";
  const currentStatus = data?.status ?? "pending";
  const currentWebhookStatus = data?.webhook_status ?? "pending";
  const displayNumber =
    pick(data?.display_phone_number, data?.phone_number) ?? "";

  return (
    <div>
      <PageHeader title="Conecta WhatsApp" subtitle="Valida tu conexión con WhatsApp Cloud API." />

      {/* Estado actual */}
      <div className="bg-white rounded-xl border shadow-sm p-5 sm:p-6 max-w-3xl mb-6">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div>
            <div className="text-sm text-muted-foreground">Estado de la conexión</div>
            <div className="mt-1">
              <StatusBadge status={currentStatus}>{statusLabel(currentStatus)}</StatusBadge>
            </div>
            <div className="mt-2 text-sm">
              <StatusBadge status={currentWebhookStatus === "connected" || currentWebhookStatus === "active" ? "connected" : "pending"}>
                {webhookStatusLabel(currentWebhookStatus)}
              </StatusBadge>
            </div>
          </div>
          <div className="text-sm text-right space-y-0.5">
            {displayNumber && <div className="font-medium">{displayNumber}</div>}
            {data?.verified_name && (
              <div className="text-muted-foreground">Nombre verificado: {data.verified_name}</div>
            )}
            <div className="text-muted-foreground">{qualityLabel(data?.quality_rating)}</div>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-xl border shadow-sm p-5 sm:p-6 max-w-3xl mb-6">
        <h2 className="text-base font-semibold mb-4">Datos de tu cuenta de WhatsApp</h2>
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
            <Label htmlFor="pnid">ID del número de teléfono</Label>
            <Input id="pnid" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="waba">WABA ID</Label>
            <Input id="waba" value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="mbid">ID del negocio de Meta (opcional)</Label>
            <Input id="mbid" value={metaBusinessId} onChange={(e) => setMetaBusinessId(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tok">Access Token temporal (solo para prueba)</Label>
            <Input
              id="tok"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              autoComplete="off"
              placeholder="Se usa solo para validar la conexión y no se guarda."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Por seguridad, este token no se guarda en Assistia. Solo se envía al servicio de validación.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onSubmit("save")} disabled={submitting} variant="outline">
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
            <Button onClick={() => onSubmit("test")} disabled={submitting}>
              {submitting ? "Probando conexión…" : "Guardar y probar conexión"}
            </Button>
          </div>
        </div>

        {result?.ok === true && (
          <div className="mt-6 rounded-lg border p-4 bg-[color:var(--success)]/10 border-[color:var(--success)]/30">
            <div className="flex items-center gap-2 text-[color:var(--success)] font-medium">
              <CheckCircle2 className="h-4 w-4" /> WhatsApp conectado correctamente.
            </div>
            <div className="mt-2 text-sm text-foreground/80 space-y-0.5">
              {result.phone_number && <div>Número: {result.phone_number}</div>}
              {result.verified_name && <div>Nombre verificado: {result.verified_name}</div>}
              <div>{qualityLabel(result.quality_rating)}</div>
              <div>Estado de conexión: {statusLabel(result.status)}</div>
              <div>Estado del webhook: {webhookStatusLabel(result.webhook_status)}</div>
            </div>
          </div>
        )}

        {result?.ok === false && (
          <div className="mt-6 rounded-lg border p-4 bg-[color:var(--destructive)]/10 border-[color:var(--destructive)]/30">
            <div className="flex items-center gap-2 text-[color:var(--destructive)] font-medium">
              <AlertTriangle className="h-4 w-4" /> {result.message || "No se pudo validar la conexión."}
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

      {/* Configura tu webhook en Meta */}
      <div className="bg-white rounded-xl border shadow-sm p-5 sm:p-6 max-w-3xl mb-6">
        <h2 className="text-base font-semibold">Configura tu webhook en Meta</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Guardar los datos valida que tu número de WhatsApp pertenece a tu cuenta de Meta.
          Configurar el webhook permite que Assistia reciba los mensajes reales de tus clientes.
          Sin esta configuración, Assistia no recibirá mensajes entrantes.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <Label>URL de recepción de mensajes</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={META_CALLBACK_URL} />
              <Button type="button" variant="outline" onClick={() => copyText(META_CALLBACK_URL, "URL")}>
                <Copy className="h-4 w-4 mr-1" /> Copiar URL
              </Button>
            </div>
          </div>

          <div>
            <Label>Token de verificación</Label>
            {verifyToken ? (
              <div className="flex gap-2 mt-1">
                <Input readOnly value={verifyToken} />
                <Button type="button" variant="outline" onClick={() => copyText(verifyToken, "Token")}>
                  <Copy className="h-4 w-4 mr-1" /> Copiar token
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                Guarda primero los datos de WhatsApp para generar el token de verificación.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Paso a paso */}
      <div className="bg-white rounded-xl border shadow-sm p-5 sm:p-6 max-w-3xl mb-6">
        <h2 className="text-base font-semibold">Paso a paso para configurar WhatsApp en Meta</h2>
        <ol className="list-decimal pl-5 mt-3 space-y-1.5 text-sm">
          <li>Entra a Meta Developers.</li>
          <li>Abre la aplicación de WhatsApp de tu empresa.</li>
          <li>En el menú lateral, entra a WhatsApp.</li>
          <li>Luego entra a Configuración.</li>
          <li>Busca la sección Webhook.</li>
          <li>Copia desde Assistia la URL de recepción de mensajes.</li>
          <li>Pégala en el campo Callback URL de Meta.</li>
          <li>Copia desde Assistia el token de verificación.</li>
          <li>Pégalo en el campo Verify Token de Meta.</li>
          <li>Haz clic en Verify and Save.</li>
          <li>Después de verificar, busca la sección de eventos.</li>
          <li>Suscríbete al evento messages.</li>
          <li>Vuelve a Assistia.</li>
          <li>Haz clic en Probar conexión.</li>
          <li>
            Si la conexión aparece correcta, envía un mensaje real al WhatsApp conectado para confirmar que
            Assistia lo recibe.
          </li>
        </ol>
        <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm">
          Usa siempre la URL de producción. No uses una URL que contenga <code>webhook-test</code>.
        </div>
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Si tu número de WhatsApp ya tenía otro webhook configurado, Meta seguirá enviando los mensajes a
          ese webhook anterior hasta que lo reemplaces por el webhook de Assistia.
        </div>
      </div>
    </div>
  );
}
