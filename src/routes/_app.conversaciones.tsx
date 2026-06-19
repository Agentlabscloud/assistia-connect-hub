import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  N8N_MANUAL_REPLY_WEBHOOK,
  N8N_GET_TEMPLATES_WEBHOOK,
} from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Conversation, Contact, Message, WhatsappTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MessagesSquare, ArrowLeft, Sparkles, Search, Send, Clock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { LeadBadge } from "@/components/LeadBadge";
import {
  tIntent,
  tStatus,
  extractMessageContent,
  formatDateTime,
  isWithin24h,
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
const CONTACT_COLUMNS =
  "id,company_id,whatsapp_account_id,name,phone,city,interest,status,last_interaction_at,last_intent,memory_summary";

type StatusFilter = "all" | "hot" | "interested" | "needs_human" | "new" | "closed";

function ConversationsPage() {
  const { companyId } = useCompany();
  const { phone: phoneFilter } = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [intentFilter, setIntentFilter] = useState<string>("all");
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

  // Use contact.status as the real classification source
  const contactsLookupQ = useQuery({
    queryKey: ["contacts-by-phone-map", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id,phone,status,last_intent,interest,last_interaction_at")
        .eq("company_id", companyId);
      const m = new Map<string, { id: string; status: string | null; last_intent: string | null; interest: string | null; last_interaction_at: string | null }>();
      for (const c of (data ?? []) as Array<{ id: string; phone: string | null; status: string | null; last_intent: string | null; interest: string | null; last_interaction_at: string | null }>) {
        if (c.phone) m.set(c.phone, { id: c.id, status: c.status, last_intent: c.last_intent, interest: c.interest, last_interaction_at: c.last_interaction_at });
      }
      return m;
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
    const cmap = contactsLookupQ.data;
    if (statusFilter !== "all") {
      arr = arr.filter((c) => {
        const cs = cmap?.get(c.customer_phone ?? "")?.status;
        return (cs ?? "").toLowerCase() === statusFilter;
      });
    }
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
    // Most-recent activity first — use latest of contact.last_interaction_at vs conv.last_message_at vs created_at
    arr.sort((a, b) => {
      const ca = cmap?.get(a.customer_phone ?? "")?.last_interaction_at ?? "";
      const cb = cmap?.get(b.customer_phone ?? "")?.last_interaction_at ?? "";
      const da = [a.last_message_at, ca, a.created_at].filter(Boolean).sort().pop() || "";
      const db = [b.last_message_at, cb, b.created_at].filter(Boolean).sort().pop() || "";
      return db.localeCompare(da);
    });
    return arr;
  }, [convsQ.data, contactsLookupQ.data, statusFilter, intentFilter, search]);

  useEffect(() => {
    if (!filteredSorted.length) return;
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nombre, teléfono o intención…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 min-h-[44px]"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Calificación" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="hot">Leads calientes</SelectItem>
            <SelectItem value="interested">Interesados</SelectItem>
            <SelectItem value="needs_human">Requieren asesor</SelectItem>
            <SelectItem value="new">Nuevos</SelectItem>
            <SelectItem value="closed">Cerrados</SelectItem>
          </SelectContent>
        </Select>
        {intentOptions.length > 0 ? (
          <Select value={intentFilter} onValueChange={setIntentFilter}>
            <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Intención" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las intenciones</SelectItem>
              {intentOptions.map((s) => (
                <SelectItem key={s} value={s}>{tIntent(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div />
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
            {filteredSorted.map((c) => {
              const contactInfo = contactsLookupQ.data?.get(c.customer_phone ?? "");
              const status = contactInfo?.status ?? null;
              const lastActivity =
                contactInfo?.last_interaction_at || c.last_message_at || c.created_at || null;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors",
                    selectedId === c.id && "bg-muted",
                  )}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <div className="font-medium text-sm truncate min-w-0">
                      {c.customer_name || c.customer_phone || "Cliente"}
                    </div>
                    {status && <LeadBadge lead={status} />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{c.customer_phone}</div>
                  {c.last_intent && (
                    <div className="mt-1.5">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted truncate inline-block max-w-full">
                        {tIntent(c.last_intent)}
                      </span>
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Última actividad: {formatDateTime(lastActivity)}
                  </div>
                </button>
              );
            })}
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

                <AISummaryPanel conv={selectedConv} contact={contactQ.data ?? null} />
              </>
            )}

            <MessagesPane
              loading={!!selectedId && messagesQ.isLoading}
              messages={messagesQ.data ?? []}
              empty={!selectedId}
            />

            {selectedConv && (
              <ReplyComposer
                conversation={selectedConv}
                contact={contactQ.data ?? null}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MessagesPane({
  loading,
  messages,
  empty,
}: {
  loading: boolean;
  messages: Message[];
  empty: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // Auto-scroll to last message
    el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  return (
    <div ref={scrollerRef} className="flex-1 p-4 overflow-y-auto bg-[color:var(--brand-ivory)]/40">
      {empty ? (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          Selecciona una conversación.
        </div>
      ) : loading ? (
        <LoadingState />
      ) : messages.length === 0 ? (
        <div className="text-sm text-muted-foreground">Sin mensajes.</div>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => {
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
                    {formatDateTime(m.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReplyComposer({
  conversation,
  contact,
}: {
  conversation: Conversation;
  contact: Contact | null;
}) {
  const { companyId } = useCompany();
  const qc = useQueryClient();
  const lastInteraction = contact?.last_interaction_at || conversation.last_message_at || null;
  const within24 = isWithin24h(lastInteraction);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "warn" | "err"; message: string } | null>(null);
  const [requiresTemplate, setRequiresTemplate] = useState(!within24);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<WhatsappTemplate[] | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when switching conversations
    setText("");
    setFeedback(null);
    setRequiresTemplate(!isWithin24h(lastInteraction));
    setShowTemplates(false);
    setTemplates(null);
    setTemplatesError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  const sendReply = async () => {
    if (!text.trim() || !companyId || !contact?.id) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch(N8N_MANUAL_REPLY_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          contact_id: contact.id,
          conversation_id: conversation.id,
          message: text.trim(),
        }),
      });
      const data: {
        success?: boolean;
        sent?: boolean;
        requires_template?: boolean;
        title?: string;
        message?: string;
      } = await res.json().catch(() => ({}));

      if (data.success && data.sent) {
        setFeedback({ tone: "ok", message: "Mensaje enviado correctamente." });
        setText("");
        qc.invalidateQueries({ queryKey: ["messages", companyId, conversation.id] });
        qc.invalidateQueries({ queryKey: ["conversations", companyId] });
      } else if (data.requires_template) {
        setRequiresTemplate(true);
        setFeedback({
          tone: "warn",
          message:
            data.message ||
            "No se envió el mensaje porque este contacto está fuera de la ventana de atención de 24 horas. Para continuar la conversación, selecciona una plantilla aprobada por Meta.",
        });
      } else {
        setFeedback({
          tone: "err",
          message: data.message || "No fue posible enviar el mensaje. Inténtalo más tarde.",
        });
      }
    } catch {
      setFeedback({ tone: "err", message: "No fue posible enviar el mensaje. Revisa tu conexión." });
    } finally {
      setSending(false);
    }
  };

  const loadTemplates = async () => {
    if (!companyId || !contact?.whatsapp_account_id) {
      setTemplatesError("No se encontró la cuenta de WhatsApp asociada a este cliente.");
      setShowTemplates(true);
      return;
    }
    setLoadingTemplates(true);
    setTemplatesError(null);
    setShowTemplates(true);
    try {
      const res = await fetch(N8N_GET_TEMPLATES_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          whatsapp_account_id: contact.whatsapp_account_id,
        }),
      });
      const data: { success?: boolean; templates?: WhatsappTemplate[] } = await res.json().catch(() => ({}));
      const approved = (data.templates ?? []).filter((t) => (t.status || "").toUpperCase() === "APPROVED");
      setTemplates(approved);
    } catch {
      setTemplatesError("No fue posible cargar las plantillas. Inténtalo más tarde.");
    } finally {
      setLoadingTemplates(false);
    }
  };

  return (
    <div className="border-t bg-white p-3 space-y-2">
      {requiresTemplate ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Clock className="h-4 w-4 mt-0.5 shrink-0 text-[color:var(--warning-foreground)]" />
            <span>
              Fuera de la ventana de 24 horas, WhatsApp requiere usar una plantilla aprobada por Meta para volver a contactar al cliente.
            </span>
          </div>
          <Button
            type="button"
            onClick={loadTemplates}
            className="min-h-[44px] w-full sm:w-auto"
            disabled={loadingTemplates}
          >
            {loadingTemplates ? "Cargando…" : "Enviar plantilla aprobada"}
          </Button>

          {showTemplates && (
            <div className="rounded-lg border bg-[color:var(--brand-ivory)]/60 p-3 text-sm">
              {loadingTemplates ? (
                <span className="text-muted-foreground">Cargando plantillas…</span>
              ) : templatesError ? (
                <span className="text-[color:var(--destructive)]">{templatesError}</span>
              ) : !templates || templates.length === 0 ? (
                <span className="text-muted-foreground">
                  No hay plantillas aprobadas disponibles en esta cuenta de WhatsApp. Crea o aprueba una plantilla desde Meta Business Manager para poder contactar clientes fuera de la ventana de 24 horas.
                </span>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Plantillas aprobadas disponibles:
                  </div>
                  <ul className="divide-y rounded-md border bg-white">
                    {templates.map((t) => (
                      <li key={`${t.name}-${t.language}`} className="px-3 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{t.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.language}{t.category ? ` · ${t.category}` : ""}
                          </div>
                        </div>
                        <span className="text-[11px] rounded-full bg-muted px-2 py-0.5">Aprobada</span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs text-muted-foreground">
                    El envío de plantillas estará disponible próximamente desde la plataforma.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Responder por WhatsApp</div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe tu respuesta…"
            rows={2}
            className="min-h-[60px] resize-none"
            disabled={sending}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={sendReply}
              disabled={sending || !text.trim()}
              className="min-h-[44px]"
            >
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Enviando…" : "Enviar respuesta"}
            </Button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={cn(
            "rounded-md border p-2 text-xs",
            feedback.tone === "ok" &&
              "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30",
            feedback.tone === "warn" &&
              "bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)] border-[color:var(--warning)]/40",
            feedback.tone === "err" &&
              "bg-[color:var(--destructive)]/10 text-[color:var(--destructive)] border-[color:var(--destructive)]/30",
          )}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}

function AISummaryPanel({ conv, contact }: { conv: Conversation; contact: Contact | null }) {
  const interest = contact?.interest || "Sin interés detectado";
  const intent = conv.last_intent || contact?.last_intent;
  const summary = conv.summary || contact?.memory_summary;
  const status = contact?.status || conv.lead_status;

  return (
    <div className="border-b bg-[color:var(--brand-ivory)] p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--brand-blue)]">
        <Sparkles className="h-3.5 w-3.5 text-[color:var(--brand-green)]" />
        Resumen IA del cliente
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip label="Interés" value={interest} />
        <Chip label="Intención" value={intent ? tIntent(intent) : "Sin intención detectada"} />
        {status ? (
          <Chip label="Calificación IA" valueNode={<LeadBadge lead={status} />} />
        ) : (
          <Chip label="Calificación IA" value="Sin calificación" />
        )}
        <Chip label="Nivel" value="Sin nivel" />
        <Chip label="Estado" value={conv.status ? tStatus(conv.status) : "Sin estado"} />
      </div>
      <div className="text-xs">
        <span className="text-muted-foreground">Siguiente acción: </span>
        <span className="font-medium">{conv.next_action || "Sin acción sugerida"}</span>
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
