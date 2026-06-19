import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState } from "@/components/ui-bits";
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
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { LeadBadge } from "@/components/LeadBadge";
import { tIntent, tStatus, formatDateTime } from "@/lib/i18n";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientsPage,
});

const CONTACT_COLUMNS =
  "id,company_id,whatsapp_account_id,name,phone,city,source,interest,status,last_interaction_at,created_at,last_intent,memory_summary,last_interest_at";

// Real values of contacts.status
type StatusFilter = "all" | "hot" | "interested" | "needs_human" | "new" | "closed";

const STATUS_PRIORITY: Record<string, number> = {
  hot: 0,
  needs_human: 1,
  interested: 2,
  new: 3,
  closed: 5,
};

function statusPriority(s?: string | null) {
  return STATUS_PRIORITY[(s || "").toLowerCase()] ?? 4;
}

function ClientsPage() {
  const { companyId } = useCompany();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [interestFilter, setInterestFilter] = useState<string>("all");

  const contactsQ = useQuery({
    queryKey: ["contacts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select(CONTACT_COLUMNS)
        .eq("company_id", companyId)
        .order("last_interaction_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      return (data as Contact[]) ?? [];
    },
  });

  const contacts = contactsQ.data ?? [];

  const interestOptions = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.interest).filter(Boolean))) as string[],
    [contacts],
  );

  const hasAnyFilter = statusFilter !== "all" || interestFilter !== "all" || search.trim() !== "";

  const filtered = useMemo(() => {
    let arr = contacts.slice();
    if (statusFilter !== "all") {
      arr = arr.filter((c) => (c.status ?? "").toLowerCase() === statusFilter);
    }
    if (interestFilter !== "all") {
      arr = arr.filter((c) => (c.interest ?? "") === interestFilter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(
        (c) =>
          (c.name ?? "").toLowerCase().includes(s) ||
          (c.phone ?? "").includes(s) ||
          (c.interest ?? "").toLowerCase().includes(s),
      );
    }
    arr.sort((a, b) => {
      const pa = statusPriority(a.status);
      const pb = statusPriority(b.status);
      if (pa !== pb) return pa - pb;
      const da = a.last_interaction_at || a.created_at || "";
      const db = b.last_interaction_at || b.created_at || "";
      return db.localeCompare(da);
    });
    return arr;
  }, [contacts, statusFilter, interestFilter, search]);

  const goConv = (phone: string | null) => {
    if (!phone) return;
    navigate({ to: "/conversaciones", search: { phone } as never });
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setInterestFilter("all");
    setSearch("");
  };

  const isLoading = contactsQ.isLoading;

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Personas que han escrito a tu WhatsApp." />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 mb-4">
        <Input
          placeholder="Buscar por nombre, teléfono o interés…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-h-[44px]"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="sm:w-52 min-h-[44px]"><SelectValue placeholder="Calificación" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="hot">Leads calientes</SelectItem>
            <SelectItem value="interested">Interesados</SelectItem>
            <SelectItem value="needs_human">Requieren asesor</SelectItem>
            <SelectItem value="new">Nuevos</SelectItem>
            <SelectItem value="closed">Cerrados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={interestFilter} onValueChange={setInterestFilter}>
          <SelectTrigger className="sm:w-52 min-h-[44px]"><SelectValue placeholder="Interés" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los intereses</SelectItem>
            {interestOptions.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        contacts.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="Sin clientes todavía"
            description="Cuando las personas escriban a tu WhatsApp, aparecerán aquí."
          />
        ) : (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No hay clientes con este filtro."
            action={
              hasAnyFilter ? (
                <Button variant="outline" onClick={clearFilters} className="min-h-[44px]">
                  Limpiar filtros
                </Button>
              ) : null
            }
          />
        )
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
                    <th className="text-left px-4 py-3">Interés</th>
                    <th className="text-left px-4 py-3">Intención IA</th>
                    <th className="text-left px-4 py-3">Calificación IA</th>
                    <th className="text-left px-4 py-3">Última actividad</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const intent = c.last_intent;
                    return (
                      <tr key={c.id} className="border-t">
                        <td className="px-4 py-3 font-medium">{c.name || "Cliente"}</td>
                        <td className="px-4 py-3">{c.phone || "—"}</td>
                        <td className="px-4 py-3">{c.interest || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3">
                          {intent ? (
                            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">{tIntent(intent)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {c.status ? <LeadBadge lead={c.status} /> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDateTime(c.last_interaction_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => goConv(c.phone)}>
                              <MessagesSquare className="h-3.5 w-3.5 mr-1" /> Ver
                            </Button>
                            <WhatsAppButton phone={c.phone} label="WhatsApp" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden grid grid-cols-1 gap-3">
            {filtered.map((c) => {
              const intent = c.last_intent;
              return (
                <div key={c.id} className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-base truncate">{c.name || "Cliente"}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.phone || "—"}</span>
                      </div>
                      {c.city && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" /> {c.city}
                        </div>
                      )}
                    </div>
                    {c.status && <LeadBadge lead={c.status} />}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {c.interest ? (
                      <Tag tone="green">Interés: {c.interest}</Tag>
                    ) : (
                      <Tag>Interés: —</Tag>
                    )}
                    {intent ? (
                      <Tag>Intención IA: {tIntent(intent)}</Tag>
                    ) : (
                      <Tag>Intención IA: —</Tag>
                    )}
                    <Tag>Calificación IA: {tStatus(c.status)}</Tag>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Última actividad: {formatDateTime(c.last_interaction_at)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => goConv(c.phone)}>
                      <MessagesSquare className="h-4 w-4 mr-1" /> Ver
                    </Button>
                    <WhatsAppButton phone={c.phone} className="min-h-[44px]" label="WhatsApp" />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "green" }) {
  const cls =
    tone === "green"
      ? "bg-[color:var(--brand-green)]/15 text-[color:var(--brand-blue)] border-[color:var(--brand-green)]/30"
      : "bg-muted text-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${cls}`}>{children}</span>
  );
}
