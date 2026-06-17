import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { tStatus } from "@/lib/i18n";
import type { Assistant, WhatsappAccount } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/configuracion")({
  component: SettingsPage,
});

interface FormState {
  name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  legal_name: string;
  address: string;
  tax_id: string;
  industry: string;
}

const EMPTY: FormState = {
  name: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  legal_name: "",
  address: "",
  tax_id: "",
  industry: "",
};

function SettingsPage() {
  const { company, companyId, loading, refetch } = useCompany();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);

  const assistantQ = useQuery({
    queryKey: ["assistant-cfg", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("assistants")
        .select("id,business_description,assistant_type,status")
        .eq("company_id", companyId)
        .maybeSingle();
      return (data as Assistant) ?? null;
    },
  });

  const waQ = useQuery({
    queryKey: ["wa-cfg", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_accounts")
        .select("id,status,webhook_status")
        .eq("company_id", companyId)
        .maybeSingle();
      return (data as WhatsappAccount) ?? null;
    },
  });


  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        email: company.email ?? "",
        phone: company.phone ?? "",
        country: company.country ?? "",
        city: company.city ?? "",
        legal_name: company.legal_name ?? "",
        address: company.address ?? "",
        tax_id: company.tax_id ?? "",
        industry: company.industry ?? "",
      });
    }
  }, [company]);

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("update_my_company_settings", {
        p_name: form.name || null,
        p_email: form.email || null,
        p_country: form.country || null,
        p_legal_name: form.legal_name || null,
        p_phone: form.phone || null,
        p_industry: form.industry || null,
        p_city: form.city || null,
        p_address: form.address || null,
        p_tax_id: form.tax_id || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Información actualizada correctamente.");
      await refetch();
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("No se pudo guardar", { description: e.message }),
  });

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Administra la información de tu empresa." />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
        className="space-y-6 max-w-3xl"
      >
        <section className="bg-white rounded-xl border shadow-sm p-5 sm:p-6 space-y-5">
          <h2 className="text-base font-semibold">Información general</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nombre de la empresa" id="name">
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email de contacto" id="email">
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Teléfono" id="phone">
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Industria" id="industry">
              <Input id="industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-xl border shadow-sm p-5 sm:p-6 space-y-5">
          <h2 className="text-base font-semibold">Ubicación</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="País" id="country">
              <Input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </Field>
            <Field label="Ciudad" id="city">
              <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Dirección" id="address">
                <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border shadow-sm p-5 sm:p-6 space-y-5">
          <h2 className="text-base font-semibold">Datos fiscales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Razón social / nombre legal" id="legal_name">
              <Input id="legal_name" value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
            </Field>
            <Field label="NIT" id="tax_id">
              <Input id="tax_id" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="bg-white rounded-xl border shadow-sm p-5 sm:p-6">
          <h2 className="text-base font-semibold mb-3">Estado de la cuenta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Estado</div>
              <StatusBadge status={company?.status ?? "—"}>{company?.status ?? "—"}</StatusBadge>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Onboarding</div>
              <StatusBadge status={company?.onboarding_status ?? "—"}>{company?.onboarding_status ?? "—"}</StatusBadge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Estos valores son administrados por AgentLabs Cloud y no son editables.
          </p>
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
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
