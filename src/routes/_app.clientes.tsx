import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState, StatusBadge } from "@/components/ui-bits";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import type { Contact } from "@/lib/types";
import { Users, MessagesSquare, Phone, MapPin } from "lucide-react";
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

const CONTACT_COLUMNS =
  "id,company_id,whatsapp_account_id,name,phone,city,source,interest,status,last_interaction_at,created_at";

function ClientsPage() {
  const { companyId } = useCompany();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select(CONTACT_COLUMNS)
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

  const statuses = useMemo(
    () => Array.from(new Set((data ?? []).map((c) => c.status).filter(Boolean))) as string[],
    [data],
  );

  const goConv = (phone: string | null) => {
    if (!phone) return;
    navigate({ to: "/conversaciones", search: { phone } as never });
  };

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Personas que han escrito a tu WhatsApp." />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="Buscar por nombre o teléfono…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
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
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Nombre</th>
                    <th className="text-left px-4 py-3">Teléfono</th>
                    <th className="text-left px-4 py-3">Ciudad</th>
                    <th className="text-left px-4 py-3">Interés</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Última interacción</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{c.name || "—"}</td>
                      <td className="px-4 py-3">{c.phone || "—"}</td>
                      <td className="px-4 py-3">{c.city || "—"}</td>
                      <td className="px-4 py-3">{c.interest || "—"}</td>
                      <td className="px-4 py-3">{c.status ? <StatusBadge status={c.status} /> : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleString("es") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="outline" size="sm" onClick={() => goConv(c.phone)}>
                          <MessagesSquare className="h-3.5 w-3.5 mr-1" /> Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden grid grid-cols-1 gap-3">
            {filtered.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name || "Sin nombre"}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> {c.phone || "—"}
                    </div>
                    {c.city && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {c.city}
                      </div>
                    )}
                  </div>
                  {c.status && <StatusBadge status={c.status} />}
                </div>
                {c.interest && <div className="text-xs mt-2"><span className="text-muted-foreground">Interés:</span> {c.interest}</div>}
                <div className="text-xs text-muted-foreground mt-2">
                  {c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleString("es") : "—"}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => goConv(c.phone)}>
                  <MessagesSquare className="h-3.5 w-3.5 mr-1" /> Ver conversaciones
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
