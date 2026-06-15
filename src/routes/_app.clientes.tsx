import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState, StatusBadge } from "@/components/ui-bits";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import type { Contact } from "@/lib/types";
import { Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientsPage,
});

function ClientsPage() {
  const { companyId } = useCompany();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .eq("company_id", companyId)
        .order("last_interaction_at", { ascending: false, nullsFirst: false });
      return (data as Contact[]) ?? [];
    },
  });

  const filtered = useMemo(() => {
    let arr = data ?? [];
    if (status !== "all") arr = arr.filter((c) => c.status === status);
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter((c) => (c.name ?? "").toLowerCase().includes(s) || (c.phone ?? "").includes(s));
    }
    return arr;
  }, [data, search, status]);

  const statuses = useMemo(() => Array.from(new Set((data ?? []).map((c) => c.status).filter(Boolean))) as string[], [data]);

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Personas que han escrito a tu WhatsApp." />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="Buscar por nombre o teléfono…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los status</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Sin clientes todavía"
          description="Cuando las personas escriban a tu WhatsApp, aparecerán aquí."
        />
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-left px-4 py-3">Teléfono</th>
                  <th className="text-left px-4 py-3">Ciudad</th>
                  <th className="text-left px-4 py-3">Fuente</th>
                  <th className="text-left px-4 py-3">Interés</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Última interacción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{c.name || "—"}</td>
                    <td className="px-4 py-3">{c.phone || "—"}</td>
                    <td className="px-4 py-3">{c.city || "—"}</td>
                    <td className="px-4 py-3">{c.source || "—"}</td>
                    <td className="px-4 py-3">{c.interest || "—"}</td>
                    <td className="px-4 py-3">{c.status ? <StatusBadge status={c.status} /> : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleString("es") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
