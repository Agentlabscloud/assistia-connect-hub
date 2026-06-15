import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import type { Assistant, AssistantType } from "@/lib/types";

export const Route = createFileRoute("/_app/assistia")({
  component: AssistantPage,
});

const ASSISTANT_COLUMNS =
  "id,company_id,name,product_name,business_description,tone,fallback_message,handoff_phone,assistant_type,status";

interface GuidedFields {
  city_country: string;
  hours: string;
  products: string;
  prices: string;
  payments: string;
  faq: string;
  policies: string;
  extra_info: string;
  free_text: string;
}

const EMPTY_GUIDED: GuidedFields = {
  city_country: "",
  hours: "",
  products: "",
  prices: "",
  payments: "",
  faq: "",
  policies: "",
  extra_info: "",
  free_text: "",
};

const GUIDED_MARK = "## DATOS GUIADOS ASSISTIA";

function parseGuided(raw: string | null | undefined): GuidedFields {
  if (!raw) return { ...EMPTY_GUIDED };
  const idx = raw.indexOf(GUIDED_MARK);
  if (idx === -1) return { ...EMPTY_GUIDED, free_text: raw };
  const free_text = raw.slice(0, idx).trim();
  const body = raw.slice(idx + GUIDED_MARK.length);
  const get = (key: string) => {
    const m = body.match(new RegExp(`### ${key}\\n([\\s\\S]*?)(?=\\n### |$)`));
    return m ? m[1].trim() : "";
  };
  return {
    city_country: get("Ciudad / país"),
    hours: get("Horarios de atención"),
    products: get("Productos o servicios"),
    prices: get("Precios o planes"),
    payments: get("Métodos de pago"),
    faq: get("Preguntas frecuentes"),
    policies: get("Políticas importantes"),
    extra_info: get("Información adicional"),
    free_text,
  };
}

function serializeGuided(g: GuidedFields): string {
  const sections: Array<[string, string]> = [
    ["Ciudad / país", g.city_country],
    ["Horarios de atención", g.hours],
    ["Productos o servicios", g.products],
    ["Precios o planes", g.prices],
    ["Métodos de pago", g.payments],
    ["Preguntas frecuentes", g.faq],
    ["Políticas importantes", g.policies],
    ["Información adicional", g.extra_info],
  ];
  const body = sections
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `### ${k}\n${v.trim()}`)
    .join("\n\n");
  const out = [g.free_text.trim(), body ? `${GUIDED_MARK}\n${body}` : ""].filter(Boolean).join("\n\n");
  return out;
}

const TYPE_LABEL: Record<string, string> = {
  ventas: "Ventas",
  soporte: "Soporte",
  agenda: "Agenda",
};

function buildSystemPrompt(a: {
  name: string;
  product_name: string;
  assistant_type: AssistantType;
  business_description: string;
  tone: string;
  handoff_phone: string;
  fallback_message: string;
}) {
  const typeLabel = TYPE_LABEL[a.assistant_type] || "Atención general";
  return [
    `Eres ${a.name || "el asistente IA"} de ${a.product_name || "la empresa"}.`,
    `Tu rol principal es: ${typeLabel}.`,
    `Tono de comunicación: ${a.tone || "amigable y profesional"}.`,
    "",
    "Información del negocio:",
    a.business_description || "(sin descripción)",
    "",
    a.handoff_phone
      ? `Si el cliente necesita hablar con una persona, indícale que puede contactarse al ${a.handoff_phone}.`
      : "",
    "",
    `Si no tienes información suficiente para responder, usa este mensaje: "${a.fallback_message || "Permíteme verificar y te confirmo."}"`,
    "",
    "Reglas:",
    "- Responde siempre en español.",
    "- Sé breve, claro y útil.",
    "- No inventes información que no esté en tus datos.",
  ]
    .filter(Boolean)
    .join("\n");
}

function AssistantPage() {
  const { companyId } = useCompany();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["assistant", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("assistants")
        .select(ASSISTANT_COLUMNS)
        .eq("company_id", companyId)
        .maybeSingle();
      return (data as Assistant) ?? null;
    },
  });

  const [form, setForm] = useState({
    name: "",
    product_name: "",
    assistant_type: "ventas" as AssistantType,
    tone: "",
    handoff_phone: "",
    fallback_message: "",
  });
  const [guided, setGuided] = useState<GuidedFields>(EMPTY_GUIDED);

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name ?? "",
        product_name: data.product_name ?? "",
        assistant_type: (data.assistant_type as AssistantType) ?? "ventas",
        tone: data.tone ?? "",
        handoff_phone: data.handoff_phone ?? "",
        fallback_message: data.fallback_message ?? "",
      });
      setGuided(parseGuided(data.business_description));
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!data?.id) throw new Error("No existe el asistente para esta empresa.");
      const business_description = serializeGuided(guided);
      const system_prompt = buildSystemPrompt({
        ...form,
        business_description,
      });
      const { error } = await supabase
        .from("assistants")
        .update({
          name: form.name,
          product_name: form.product_name,
          assistant_type: form.assistant_type,
          tone: form.tone,
          handoff_phone: form.handoff_phone,
          fallback_message: form.fallback_message,
          business_description,
          system_prompt,
        })
        .eq("id", data.id)
        .eq("company_id", companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cambios guardados");
      qc.invalidateQueries({ queryKey: ["assistant", companyId] });
    },
    onError: (e: Error) => toast.error("No se pudo guardar", { description: e.message }),
  });

  if (isLoading) return <LoadingState />;

  if (!data) {
    return (
      <div>
        <PageHeader title="Configura Assistia" subtitle="Define cómo debe responder tu asistente por WhatsApp." />
        <EmptyState title="Aún no hay asistente" description="Tu asistente aparecerá aquí cuando se cree automáticamente." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Configura Assistia" subtitle="Define cómo debe responder tu asistente por WhatsApp." />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
        className="space-y-6"
      >
        <section className="bg-white rounded-xl border shadow-sm p-5 sm:p-6 space-y-5">
          <h2 className="text-base font-semibold">Información básica</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nombre del asistente" id="name">
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Nombre del producto o negocio" id="product_name">
              <Input id="product_name" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
            </Field>
            <Field label="Tipo de asistente" id="assistant_type">
              <Select value={form.assistant_type} onValueChange={(v) => setForm({ ...form, assistant_type: v })}>
                <SelectTrigger id="assistant_type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ventas">Ventas</SelectItem>
                  <SelectItem value="soporte">Soporte</SelectItem>
                  <SelectItem value="agenda">Agenda</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tono" id="tone" help="Ej: amigable, profesional, cercano…">
              <Input id="tone" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-xl border shadow-sm p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold">Qué vende u ofrece el negocio</h2>
            <p className="text-sm text-muted-foreground">Completa estos campos para que tu asistente tenga toda la información que necesita.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Ciudad / país" id="g_city">
              <Input id="g_city" value={guided.city_country} onChange={(e) => setGuided({ ...guided, city_country: e.target.value })} />
            </Field>
            <Field label="Horarios de atención" id="g_hours">
              <Input id="g_hours" value={guided.hours} onChange={(e) => setGuided({ ...guided, hours: e.target.value })} placeholder="Lun a Vie 9am-6pm" />
            </Field>
          </div>
          <Field label="Productos o servicios principales" id="g_products">
            <Textarea id="g_products" rows={3} value={guided.products} onChange={(e) => setGuided({ ...guided, products: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Precios o planes" id="g_prices">
              <Textarea id="g_prices" rows={3} value={guided.prices} onChange={(e) => setGuided({ ...guided, prices: e.target.value })} />
            </Field>
            <Field label="Métodos de pago" id="g_payments">
              <Textarea id="g_payments" rows={3} value={guided.payments} onChange={(e) => setGuided({ ...guided, payments: e.target.value })} />
            </Field>
          </div>
          <Field label="Preguntas frecuentes" id="g_faq">
            <Textarea id="g_faq" rows={4} value={guided.faq} onChange={(e) => setGuided({ ...guided, faq: e.target.value })} />
          </Field>
          <Field label="Políticas importantes" id="g_policies" help="Devoluciones, envíos, garantías, etc.">
            <Textarea id="g_policies" rows={3} value={guided.policies} onChange={(e) => setGuided({ ...guided, policies: e.target.value })} />
          </Field>
          <Field label="Información adicional que la IA debe conocer" id="g_extra">
            <Textarea id="g_extra" rows={3} value={guided.extra_info} onChange={(e) => setGuided({ ...guided, extra_info: e.target.value })} />
          </Field>
        </section>

        <section className="bg-white rounded-xl border shadow-sm p-5 sm:p-6 space-y-5">
          <h2 className="text-base font-semibold">Atención humana</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Teléfono de handoff" id="handoff_phone" help="Número al que se enviará al cliente si necesita hablar con una persona.">
              <Input id="handoff_phone" value={form.handoff_phone} onChange={(e) => setForm({ ...form, handoff_phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Mensaje de fallback" id="fallback_message" help="Mensaje que se usará cuando el asistente no tenga información suficiente.">
            <Textarea id="fallback_message" rows={3} value={form.fallback_message} onChange={(e) => setForm({ ...form, fallback_message: e.target.value })} />
          </Field>
        </section>

        <div className="sticky bottom-20 lg:bottom-4 bg-white/80 backdrop-blur rounded-xl border p-3 flex justify-end">
          <Button type="submit" disabled={mut.isPending} className="w-full sm:w-auto">
            {mut.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  id,
  help,
  children,
}: {
  label: string;
  id: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
