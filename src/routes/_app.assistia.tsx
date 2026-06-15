import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import type { Assistant } from "@/lib/types";

export const Route = createFileRoute("/_app/assistia")({
  component: AssistantPage,
});

const EDITABLE_FIELDS = [
  "name",
  "product_name",
  "business_description",
  "system_prompt",
  "tone",
  "fallback_message",
  "handoff_phone",
] as const;

type Form = Pick<Assistant, (typeof EDITABLE_FIELDS)[number]>;

function AssistantPage() {
  const { companyId } = useCompany();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["assistant", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("assistants").select("*").eq("company_id", companyId).maybeSingle();
      return (data as Assistant) ?? null;
    },
  });

  const [form, setForm] = useState<Form>({
    name: "",
    product_name: "",
    business_description: "",
    system_prompt: "",
    tone: "",
    fallback_message: "",
    handoff_phone: "",
  });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name ?? "",
        product_name: data.product_name ?? "",
        business_description: data.business_description ?? "",
        system_prompt: data.system_prompt ?? "",
        tone: data.tone ?? "",
        fallback_message: data.fallback_message ?? "",
        handoff_phone: data.handoff_phone ?? "",
      });
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!data?.id) throw new Error("No existe el asistente para esta empresa.");
      const { error } = await supabase
        .from("assistants")
        .update(form)
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

  return (
    <div>
      <PageHeader title="Configura Assistia" subtitle="Define cómo debe responder tu asistente por WhatsApp." />

      {!data ? (
        <EmptyState title="Aún no hay asistente" description="Tu asistente aparecerá aquí cuando se cree automáticamente." />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
          className="bg-white rounded-xl border shadow-sm p-6 space-y-5 max-w-3xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nombre" id="name">
              <Input id="name" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Nombre del producto" id="product_name">
              <Input id="product_name" value={form.product_name ?? ""} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
            </Field>
          </div>

          <Field
            label="Descripción del negocio"
            id="business_description"
            help="Describe qué vende tu empresa, a quién atiende y qué información debe conocer el asistente."
          >
            <Textarea
              id="business_description"
              rows={4}
              value={form.business_description ?? ""}
              onChange={(e) => setForm({ ...form, business_description: e.target.value })}
            />
          </Field>

          <Field
            label="Instrucciones (system prompt)"
            id="system_prompt"
            help="Instrucciones principales que seguirá tu asistente al responder por WhatsApp."
          >
            <Textarea
              id="system_prompt"
              rows={6}
              value={form.system_prompt ?? ""}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Tono" id="tone">
              <Input id="tone" value={form.tone ?? ""} onChange={(e) => setForm({ ...form, tone: e.target.value })} placeholder="amigable, profesional…" />
            </Field>
            <Field
              label="Teléfono de handoff"
              id="handoff_phone"
              help="Número al que se enviará al cliente si necesita hablar con una persona."
            >
              <Input id="handoff_phone" value={form.handoff_phone ?? ""} onChange={(e) => setForm({ ...form, handoff_phone: e.target.value })} />
            </Field>
          </div>

          <Field
            label="Mensaje de fallback"
            id="fallback_message"
            help="Mensaje que se usará cuando el asistente no tenga información suficiente."
          >
            <Textarea
              id="fallback_message"
              rows={3}
              value={form.fallback_message ?? ""}
              onChange={(e) => setForm({ ...form, fallback_message: e.target.value })}
            />
          </Field>

          <div className="pt-2">
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      )}
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
