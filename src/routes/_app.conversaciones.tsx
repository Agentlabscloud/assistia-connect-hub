import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import type { Conversation, Contact, Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MessagesSquare, ArrowLeft, User } from "lucide-react";

export const Route = createFileRoute("/_app/conversaciones")({
  component: ConversationsPage,
  validateSearch: (s: Record<string, unknown>) => ({
    phone: typeof s.phone === "string" ? (s.phone as string) : undefined,
  }),
});

const CONV_COLUMNS =
  "id,company_id,assistant_id,whatsapp_account_id,customer_name,customer_phone,status,last_message_at,lead_status,interest_level,notes";
const MSG_COLUMNS = "id,conversation_id,company_id,direction,message_type,content,created_at";
const CONTACT_COLUMNS = "id,name,phone,city,interest,status,last_interaction_at";

function ConversationsPage() {
  const { companyId } = useCompany();
  const { phone: phoneFilter } = Route.useSearch();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const convsQ = useQuery({
    queryKey: ["conversations", companyId, phoneFilter ?? null],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("conversations")
        .select(CONV_COLUMNS)
        .eq("company_id", companyId)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (phoneFilter) q = q.eq("customer_phone", phoneFilter);
      const { data } = await q;
      return (data as Conversation[]) ?? [];
    },
  });

  useEffect(() => {
    if (!selectedId && convsQ.data && convsQ.data.length > 0) {
      // auto-select on desktop only
      if (typeof window !== "undefined" && window.innerWidth >= 1024) {
        setSelectedId(convsQ.data[0].id);
      }
    }
  }, [convsQ.data, selectedId]);

  const selectedConv = convsQ.data?.find((c) => c.id === selectedId) ?? null;

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

      {convsQ.isLoading ? (
        <LoadingState />
      ) : (convsQ.data ?? []).length === 0 ? (
        <EmptyState
          icon={<MessagesSquare className="h-8 w-8" />}
          title="Todavía no hay conversaciones registradas."
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
            {(convsQ.data ?? []).map((c) => (
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
                    {c.customer_name || c.customer_phone || "Sin nombre"}
                  </div>
                  {c.status && <StatusBadge status={c.status} />}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{c.customer_phone}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {c.last_message_at ? new Date(c.last_message_at).toLocaleString("es") : ""}
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div
            className={cn(
              "lg:col-span-2 flex flex-col max-h-[80vh] lg:max-h-[70vh]",
              !selectedId && "hidden lg:flex",
            )}
          >
            {selectedConv && (
              <div className="border-b p-3 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden -ml-2"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {selectedConv.customer_name || selectedConv.customer_phone}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {selectedConv.customer_phone}
                    {contactQ.data?.city && ` · ${contactQ.data.city}`}
                  </div>
                </div>
                {contactQ.data?.status && <StatusBadge status={contactQ.data.status} />}
              </div>
            )}

            {contactQ.data && (
              <div className="px-4 py-2 bg-[color:var(--brand-ivory)] border-b text-xs flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                {contactQ.data.interest && <span>Interés: {contactQ.data.interest}</span>}
                {contactQ.data.last_interaction_at && (
                  <span className="ml-auto">
                    Última: {new Date(contactQ.data.last_interaction_at).toLocaleDateString("es")}
                  </span>
                )}
              </div>
            )}

            <div className="flex-1 p-4 overflow-y-auto">
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
                  {messagesQ.data!.map((m) => (
                    <div
                      key={m.id}
                      className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                          m.direction === "outbound"
                            ? "bg-[color:var(--brand-blue)] text-white rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm",
                        )}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
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
                  ))}
                </div>
              )}
            </div>

            {selectedConv?.notes && (
              <div className="border-t p-3 text-xs text-muted-foreground bg-[color:var(--brand-ivory)]">
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
