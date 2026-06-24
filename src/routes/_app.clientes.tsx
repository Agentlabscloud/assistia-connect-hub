import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState } from "@/components/ui-bits";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import type { Contact, Assistant } from "@/lib/types";
import { Users, MessagesSquare, Phone, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { LeadBadge } from "@/components/LeadBadge";
import { tIntent, formatDateTime, statusLabelByType, statusColumnHeader, emptyStateText } from "@/lib/i18n";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientsPage,
});

const CONTACT_COLUMNS =
  "id,company_id,whatsapp_account_id,name,phone,city,source,interest,status,last_interaction_at,created_at,last_intent,memory_summary,last_interest_at";

type StatusFilter = "all" | "new" | "interested" | "hot";
const PAGE_SIZES = [20, 50, 100] as const;

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function ClientsPage() {
  const { companyId } = useCompany();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 350);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [interestFilter, setInterestFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState(1);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, interestFilter, pageSize]);

  // Assistant type drives status labels
  const assistantQ = useQuery({
    queryKey: ["assistant-type", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("assistants")
        .select("id,assistant_type")
        .eq("company_id", companyId)
        .maybeSingle();
      return (data as Assistant) ?? null;
    },
  });
  const aType = assistantQ.data?.assistant_type ?? null;

  // Interest options come from a lightweight separate query (distinct-ish via fetched values)
  const interestsQ = useQuery({
    queryKey: ["contacts-interests", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("interest")
        .eq("company_id", companyId)
        .not("interest", "is", null)
        .limit(500);
      const set = new Set<string>();
      for (const r of (data ?? []) as { interest: string | null }[]) {
        if (r.interest) set.add(r.interest);
      }
      return Array.from(set).sort();
    },
  });

  // Paginated contacts
  const contactsQ = useQuery({
    queryKey: ["contacts-page", companyId, search, statusFilter, interestFilter, page, pageSize],
    enabled: !!companyId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("contacts")
        .select(CONTACT_COLUMNS, { count: "exact" })
        .eq("company_id", companyId);

      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (interestFilter !== "all") q = q.eq("interest", interestFilter);
      if (search.trim()) {
        const s = search.trim().replace(/[%,]/g, "");
        q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,interest.ilike.%${s}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count } = await q
        .order("last_interaction_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(from, to);

      return { rows: (data as Contact[]) ?? [], total: count ?? 0 };
    },
  });

  const goConv = (phone: string | null) => {
    if (!phone) return;
    navigate({ to: "/conversaciones", search: { phone } as never });
  };

  const clearFilters = () => {
    setSearchInput("");
    setStatusFilter("all");
    setInterestFilter("all");
    setPage(1);
  };

  const rows = contactsQ.data?.rows ?? [];
  const total = contactsQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasAnyFilter = statusFilter !== "all" || interestFilter !== "all" || search.trim() !== "";

  const colHeader = statusColumnHeader(aType);

  return (
    <div>
      <PageHeader title="Clientes" subtitle="Personas que han escrito a tu WhatsApp." />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 mb-4">
        <Input
          placeholder="Buscar por nombre, teléfono o interés…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="min-h-[44px]"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="sm:w-56 min-h-[44px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="hot">{statusLabelByType("hot", aType)}</SelectItem>
            <SelectItem value="interested">{statusLabelByType("interested", aType)}</SelectItem>
            <SelectItem value="new">{statusLabelByType("new", aType)}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={interestFilter} onValueChange={setInterestFilter}>
          <SelectTrigger className="sm:w-52 min-h-[44px]"><SelectValue placeholder="Interés" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los intereses</SelectItem>
            {(interestsQ.data ?? []).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {contactsQ.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title={
            hasAnyFilter
              ? emptyStateText(aType, statusFilter === "all" ? "all" : statusFilter)
              : "Sin clientes todavía"
          }
          description={
            hasAnyFilter
              ? undefined
              : "Cuando las personas escriban a tu WhatsApp, aparecerán aquí."
          }
          action={
            hasAnyFilter ? (
              <Button variant="outline" onClick={clearFilters} className="min-h-[44px]">
                Limpiar filtros
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3">Nombre</th>
                    <th className="text-left px-4 py-3">Teléfono</th>
                    <th className="text-left px-4 py-3">Interés</th>
                    <th className="text-left px-4 py-3">Intención IA</th>
                    <th className="text-left px-4 py-3">{colHeader}</th>
                    <th className="text-left px-4 py-3">Última actividad</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{c.name || "Cliente"}</td>
                      <td className="px-4 py-3 select-all">{c.phone || "—"}</td>
                      <td className="px-4 py-3 max-w-[260px]">
                        <span className="line-clamp-2">
                          {c.interest || <span className="text-muted-foreground">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.last_intent ? (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">{tIntent(c.last_intent)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.status ? (
                          <LeadBadge lead={c.status} label={statusLabelByType(c.status, aType)} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden grid grid-cols-1 gap-3">
            {rows.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-base truncate">{c.name || "Cliente"}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate select-all">{c.phone || "—"}</span>
                    </div>
                    {c.city && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" /> {c.city}
                      </div>
                    )}
                  </div>
                  {c.status && <LeadBadge lead={c.status} label={statusLabelByType(c.status, aType)} />}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {c.interest && <Tag tone="green">Interés: {c.interest}</Tag>}
                  {c.last_intent && <Tag>Intención IA: {tIntent(c.last_intent)}</Tag>}
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
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total} clientes
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="w-24 min-h-[40px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[40px]"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <div className="text-sm tabular-nums">
                {page} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[40px]"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
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
