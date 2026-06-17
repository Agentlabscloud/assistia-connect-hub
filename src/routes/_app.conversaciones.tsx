import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import type { Conversation, Contact, Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MessagesSquare, ArrowLeft, Sparkles, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { LeadBadge } from "@/routes/_app.clientes";
import {
  tInterestLevel,
  tIntent,
  tStatus,
  extractMessageContent,
  leadPriority,
  interestPriority,
} from "@/lib/i18n";

export const Route = createFileRoute("/_app/conversaciones")({
  component: ConversationsPage,
  validateSearch: (s: Record<string, unknown>) => ({
    phone: typeof s.phone === "string" ? (s.phone as string) : undefined,
  }),
});

const CONV_COLUMNS =
  "id,company_id,assistant_id,whatsapp_account_id,customer_name,customer_phone,status,last_message_at,created_at,lead_status,interest_level,notes,summary,last_intent,next_action";
const MSG_COLUMNS = "id,conversation_id,company_id,direction,message_type,content,created_at";
const CONTACT_COLUMNS = "id,name,phone,city,interest,status,last_interaction_at,last_intent,memory_summary";

type LeadFilter = "all" | "hot" | "interested" | "needs_human" | "closed";
type LevelFilter = "all" | "high" | "medium" | "low";
type SortOpt = "recent" | "hot" | "interest";

function ConversationsPage() {
  const { companyId } = useCompany();
  const { phone: phoneFilter } = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [leadFilter, setLeadFilter] = useState<LeadFilter>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOpt>("recent");
  const [search, setSearch] = useState("");

  const convsQ = useQuery({
    queryKey: ["conversations", companyId, phoneFilter ?? null],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("conversations")
        .select(CONV_COLUMNS)
        .eq("company_id", companyId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (phoneFilter) q = q.eq("customer_phone", phoneFilter);
      const { data } = await q;
      return (data as Conversation[]) ?? [];
    },
  });

  const intentOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of convsQ.data ?? []) {
      if (c.last_intent) s.add(c.last_intent);
    }
    return Array.from(s);
  }, [convsQ.data]);

  const filteredSorted = useMemo(() => {
    let arr = (convsQ.data ?? []).slice();
    if (leadFilter !== "all") arr = arr.filter((c) => (c.lead_status ?? "").toLowerCase() === leadFilter);
    if (levelFilter !== "all") arr = arr.filter((c) => (c.interest_level ?? "").toLowerCase() === levelFilter);
    if (intentFilter !== "all") arr = arr.filter((c) => (c.last_intent ?? "") === intentFilter);
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(
        (c) =>
          (c.customer_name ?? "").toLowerCase().includes(s) ||
          (c.customer_phone ?? "").includes(s) ||
          (c.last_intent ?? "").toLowerCase().includes(s),
      );
    }
    if (sortBy === "hot") {
      arr.sort((a, b) => leadPriority(a.lead_status) - leadPriority(b.lead_status));
    } else if (sortBy === "interest") {
      arr.sort((a, b) => interestPriority(a.interest_level) - interestPriority(b.interest_level));
    } else {
      arr.sort((a, b) => {
        const da = a.last_message_at || a.created_at || "";
        const db = b.last_message_at || b.created_at || "";
        return db.localeCompare(da);
      });
    }
    return arr;
  }, [convsQ.data, leadFilter, levelFilter, intentFilter, search, sortBy]);

  useEffect(() => {
    if (!filteredSorted.length) return;
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      // Always select the most recent on desktop
      if (!selectedId || !filteredSorted.find((c) => c.id === selectedId)) {
        setSelectedId(filteredSorted[0].id);
      }
    }
  }, [filteredSorted, selectedId]);

  const selectedConv = filteredSorted.find((c) => c.id === selectedId) ?? null;

  const messagesQ = useQuery({
    queryKey: ["messages", companyId, selectedId],
    enabled: !!companyId && !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select(MSG_COLUMNS)
        .eq("company_id", companyId)
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true });
      return (data as Message[]) ?? [];
    },
  });

  const contactQ = useQuery({
    queryKey: ["contact-by-phone", companyId, selectedConv?.customer_phone ?? null],
    enabled: !!companyId && !!selectedConv?.customer_phone,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select(CONTACT_COLUMNS)
        .eq("company_id", companyId)
        .eq("phone", selectedConv!.customer_phone!)
        .maybeSingle();
      return (data as Contact) ?? null;
    },
  });

  return (
    <div>
      <PageHeader title="Conversaciones" subtitle="Revisa las conversaciones atendidas por Assistia." />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nombre, teléfono o intención…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 min-h-[44px]"
          />
        </div>
        <Select value={leadFilter} onValueChange={(v) => setLeadFilter(v as LeadFilter)}>
          <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Potencial" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="hot">Leads calientes</SelectItem>
            <SelectItem value="interested">Interesados</SelectItem>
            <SelectItem value="needs_human">Requieren asesor</SelectItem>
            <SelectItem value="closed">Cerrados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as LevelFilter)}>
          <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Nivel de interés" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los niveles</SelectItem>
            <SelectItem value="high">Alto</SelectItem>
            <SelectItem value="medium">Medio</SelectItem>
            <SelectItem value="low">Bajo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOpt)}>
          <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Ordenar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Más recientes</SelectItem>
            <SelectItem value="hot">Leads calientes primero</SelectItem>
            <SelectItem value="interest">Mayor interés primero</SelectItem>
          </SelectContent>
        </Select>
        {intentOptions.length > 0 && (
          <Select value={intentFilter} onValueChange={setIntentFilter}>
            <SelectTrigger className="min-h-[44px] sm:col-span-2 lg:col-span-5"><SelectValue placeholder="Intención" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las intenciones</SelectItem>
              {intentOptions.map((s) => (
                <SelectItem key={s} value={s}>{tIntent(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {convsQ.isLoading ? (
        <LoadingState />
      ) : filteredSorted.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare className="h-8 w-8" />}
          title="Sin conversaciones"
          description="Aquí aparecerán las conversaciones de tus clientes con Assistia."
        />
      ) : (
        <div className="lg:grid lg:grid-cols-3 lg:gap-4 bg-white rounded-xl border shadow-sm overflow-hidden">
          {/* List */}
          <div
            className={cn(
              "border-r max-h-[70vh] overflow-y-auto",
              selectedId && "hidden lg:block",
            )}
          >
            {filteredSorted.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors",
                  selectedId === c.id && "bg-muted",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm truncate">
                    {c.customer_name || c.customer_phone || "Cliente"}
                  </div>
                  {c.lead_status && <LeadBadge lead={c.lead_status} />}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{c.customer_phone}</div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {c.interest_level && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted">
                      Nivel: {tInterestLevel(c.interest_level)}
                    </span>
                  )}
                  {c.last_intent && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted truncate max-w-[180px]">
                      {tIntent(c.last_intent)}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {c.last_message_at ? new Date(c.last_message_at).toLocaleString("es") : ""}
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div
            className={cn(
              "lg:col-span-2 flex flex-col max-h-[85vh] lg:max-h-[70vh]",
              !selectedId && "hidden lg:flex",
            )}
          >
            {selectedConv && (
              <>
                <div className="border-b p-3 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden -ml-2 min-h-[40px]"
                    onClick={() => setSelectedId(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">
                      {selectedConv.customer_name || selectedConv.customer_phone || "Cliente"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {selectedConv.customer_phone}
                      {contactQ.data?.city && ` · ${contactQ.data.city}`}
                    </div>
                  </div>
                  <WhatsAppButton phone={selectedConv.customer_phone} label="Contactar" />
                </div>

                {/* AI summary panel */}
                <AISummaryPanel
                  conv={selectedConv}
                  contact={contactQ.data ?? null}
                />
              </>
            )}

            <div className="flex-1 p-4 overflow-y-auto bg-[color:var(--brand-ivory)]/40">
              {!selectedId ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Selecciona una conversación.
                </div>
              ) : messagesQ.isLoading ? (
                <LoadingState />
              ) : (messagesQ.data ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">Sin mensajes.</div>
              ) : (
                <div className="space-y-2">
                  {messagesQ.data!.map((m) => {
                    const text = extractMessageContent(m.content);
                    return (
                      <div
                        key={m.id}
                        className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                            m.direction === "outbound"
                              ? "bg-[color:var(--brand-blue)] text-white rounded-br-sm"
                              : "bg-white border text-foreground rounded-bl-sm",
                          )}
                        >
                          <div className="whitespace-pre-wrap break-words">{text}</div>
                          <div
                            className={cn(
                              "text-[10px] mt-1",
                              m.direction === "outbound" ? "text-white/70" : "text-muted-foreground",
                            )}
                          >
                            {m.created_at ? new Date(m.created_at).toLocaleString("es") : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedConv?.notes && (
              <div className="border-t p-3 text-xs text-muted-foreground bg-white">
                <span className="font-medium text-foreground">Notas: </span>
                {selectedConv.notes}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AISummaryPanel({ conv, contact }: { conv: Conversation; contact: Contact | null }) {
  const interest = contact?.interest || "Sin interés detectado";
  const intent = conv.last_intent || contact?.last_intent;
  const summary = conv.summary || contact?.memory_summary;
  const nextAction = conv.next_action;
  const status = conv.status;

  return (
    <div className="border-b bg-[color:var(--brand-ivory)] p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--brand-blue)]">
        <Sparkles className="h-3.5 w-3.5 text-[color:var(--brand-green)]" />
        Resumen IA del cliente
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip label="Interés" value={interest} />
        <Chip label="Intención" value={intent ? tIntent(intent) : "Sin intención detectada"} />
        {conv.lead_status && (
          <Chip label="Calificación IA" valueNode={<LeadBadge lead={conv.lead_status} />} />
        )}
        {conv.interest_level && (
          <Chip label="Nivel" value={tInterestLevel(conv.interest_level)} />
        )}
        {status && (
          <Chip label="Estado" valueNode={<StatusBadge status={status}>{tStatus(status)}</StatusBadge>} />
        )}
      </div>
      <div className="text-xs">
        <span className="text-muted-foreground">Siguiente acción: </span>
        <span className="font-medium">{nextAction || "Sin acción sugerida"}</span>
      </div>
      {summary && (
        <div className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Resumen: </span>
          {summary}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-0.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      {valueNode ?? <span className="font-medium">{value}</span>}
    </span>
  );
}
