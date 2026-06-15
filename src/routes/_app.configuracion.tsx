import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app/configuracion")({
  component: SettingsPage,
});

function SettingsPage() {
  const { company, companyId, loading, refetch } = useCompany();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", country: "" });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        email: company.email ?? "",
        country: company.country ?? "",
      });
    }
  }, [company]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sin empresa.");
      const { error } = await supabase.from("companies").update(form).eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Información actualizada");
      await refetch();
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error("No se pudo guardar", { description: e.message }),
  });

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Administra la información básica de tu empresa." />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
        className="bg-white rounded-xl border shadow-sm p-6 space-y-5 max-w-2xl"
      >
        <div>
          <Label htmlFor="name">Nombre de la empresa</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="email">Email de contacto</Label>
          <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="country">País</Label>
          <Input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Status</div>
            <StatusBadge status={company?.status ?? "—"}>{company?.status ?? "—"}</StatusBadge>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Onboarding</div>
            <StatusBadge status={company?.onboarding_status ?? "—"}>{company?.onboarding_status ?? "—"}</StatusBadge>
          </div>
        </div>

        <div className="pt-2">
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </div>
  );
}
