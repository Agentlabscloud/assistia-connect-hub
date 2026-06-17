import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState, StatusBadge } from "@/components/ui-bits";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import type { Contact, Conversation } from "@/lib/types";
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
import {
  tInterestLevel,
  tIntent,
  tStatus,
  leadPriority,
} from "@/lib/i18n";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientsPage,
});

const CONTACT_COLUMNS =
  "id,company_id,whatsapp_account_id,name,phone,city,source,interest,status,last_interaction_at,created_at,last_intent,memory_summary";

const CONV_COLUMNS_MIN =
  "id,customer_phone,lead_status,interest_level,last_intent,next_action,last_message_at";

type ConvLite = Pick<Conversation, "id" | "customer_phone" | "lead_status" | "interest_level" | "last_intent" | "next_action" | "last_message_at">;

type LeadFilter = "all" | "hot" | "interested" | "needs_human" | "no_interest";

function ClientsPage() {
  const { companyId } = useCompany();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [leadFilter, setLeadFilter] = useState<LeadFilter>("all");
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

  // Pull conversation-derived AI scoring per phone
  const convsQ = useQuery({
    queryKey: ["contacts-convs", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select(CONV_COLUMNS_MIN)
        .eq("company_id", companyId)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      return (data as ConvLite[]) ?? [];
    },
  });

  // Most-recent conversation per phone
  const convByPhone = useMemo(() => {
    const m = new Map<string, ConvLite>();
    for (const c of convsQ.data ?? []) {
      if (!c.customer_phone) continue;
      if (!m.has(c.customer_phone)) m.set(c.customer_phone, c);
    }
    return m;
  }, [convsQ.data]);

  const contacts = contactsQ.data ?? [];

  const interestOptions = useMemo(() => {
    return Array.from(new Set(contacts.map((c) => c.interest).filter(Boolean))) as string[];
  }, [contacts]);

  const filtered = useMemo(() => {
    let arr = contacts.slice();
    if (interestFilter !== "all") {
      arr = arr.filter((c) => (c.interest ?? "") === interestFilter);
    }
    if (leadFilter !== "all") {
      arr = arr.filter((c) => {
        const conv = convByPhone.get(c.phone ?? "");
        const lead = (conv?.lead_status || "").toLowerCase();
        if (leadFilter === "no_interest") return !c.interest && !conv?.last_intent;
        return lead === leadFilter;
      });
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
    // sort: hottest first, then recency
    arr.sort((a, b) => {
      const pa = leadPriority(convByPhone.get(a.phone ?? "")?.lead_status);
      const pb = leadPriority(convByPhone.get(b.phone ?? "")?.lead_status);
      if (pa !== pb) return pa - pb;
      const da = a.last_interaction_at || a.created_at || "";
      const db = b.last_interaction_at || b.created_at || "";
      return db.localeCompare(da);
    });
    return arr;
  }, [contacts, convByPhone, leadFilter, interestFilter, search]);

  const goConv = (phone: string | null) => {
    if (!phone) return;
    navigate({ to: "/conversaciones", search: { phone } as never });
  };

  const isLoading = contactsQ.isLoading || convsQ.isLoading;

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
        <Select value={leadFilter} onValueChange={(v) => setLeadFilter(v as LeadFilter)}>
          <SelectTrigger className="sm:w-52 min-h-[44px]"><SelectValue placeholder="Calificación" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="hot">Leads calientes</SelectItem>
            <SelectItem value="interested">Interesados</SelectItem>
            <SelectItem value="needs_human">Requieren asesor</SelectItem>
            <SelectItem value="no_interest">Sin interés detectado</SelectItem>
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
                    <th className="text-left px-4 py-3">Interés</th>
                    <th className="text-left px-4 py-3">Intención IA</th>
                    <th className="text-left px-4 py-3">Calificación IA</th>
                    <th className="text-left px-4 py-3">Nivel</th>
                    <th className="text-left px-4 py-3">Última</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const conv = convByPhone.get(c.phone ?? "");
                    const lead = conv?.lead_status;
                    const intent = conv?.last_intent || c.last_intent;
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
                          {lead ? <LeadBadge lead={lead} /> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {conv?.interest_level ? tInterestLevel(conv.interest_level) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleString("es") : "—"}
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
              const conv = convByPhone.get(c.phone ?? "");
              const intent = conv?.last_intent || c.last_intent;
              return (
                <div key={c.id} className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-base truncate">{c.name || "Cliente"}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3.5 w-3.5" /> {c.phone || "—"}
                      </div>
                      {c.city && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" /> {c.city}
                        </div>
                      )}
                    </div>
                    {conv?.lead_status && <LeadBadge lead={conv.lead_status} />}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {c.interest && (
                      <Tag tone="green">Interés: {c.interest}</Tag>
                    )}
                    {intent && <Tag>Intención: {tIntent(intent)}</Tag>}
                    {conv?.interest_level && <Tag>Nivel: {tInterestLevel(conv.interest_level)}</Tag>}
                    {!c.interest && !intent && (
                      <span className="text-xs text-muted-foreground">Sin interés detectado</span>
                    )}
                  </div>

                  {conv?.next_action && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Siguiente acción: </span>
                      <span className="font-medium">{conv.next_action}</span>
                    </div>
                  )}

                  {c.status && (
                    <div className="text-xs text-muted-foreground">
                      Estado: {tStatus(c.status)}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    {c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleString("es") : "—"}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => goConv(c.phone)}>
                      <MessagesSquare className="h-4 w-4 mr-1" /> Conversaciones
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

export function LeadBadge({ lead }: { lead: string }) {
  const l = lead.toLowerCase();
  const tone =
    l === "hot" ? "failed" : l === "needs_human" ? "pending" : l === "interested" ? "active" : l === "closed" ? "draft" : "pending";
  return <StatusBadge status={tone}>{tLeadStatus(lead)}</StatusBadge>;
}
