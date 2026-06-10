import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCompany } from "@/lib/company-context";
import { PageHeader, LoadingState, EmptyState, StatusBadge } from "@/components/ui-bits";
import { useState } from "react";
import type { Conversation, Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MessagesSquare } from "lucide-react";

export const Route = createFileRoute("/_app/conversations")({
  component: ConversationsPage,
});

function ConversationsPage() {
  const { companyId } = useCompany();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const convsQ = useQuery({
    queryKey: ["conversations", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("company_id", companyId)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      return (data as Conversation[]) ?? [];
    },
  });

  const messagesQ = useQuery({
    queryKey: ["messages", companyId, selectedId],
    enabled: !!companyId && !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("company_id", companyId)
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true });
      return (data as Message[]) ?? [];
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="border-r max-h-[70vh] overflow-y-auto">
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
                  <div className="font-medium text-sm truncate">{c.customer_name || c.customer_phone || "Sin nombre"}</div>
                  {c.status && <StatusBadge status={c.status} />}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{c.customer_phone}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {c.last_message_at ? new Date(c.last_message_at).toLocaleString("es") : ""}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 p-4 max-h-[70vh] overflow-y-auto">
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
                        "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                        m.direction === "outbound"
                          ? "bg-[color:var(--brand-blue)] text-white rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm",
                      )}
                    >
                      <div>{m.content}</div>
                      <div className={cn("text-[10px] mt-1", m.direction === "outbound" ? "text-white/70" : "text-muted-foreground")}>
                        {m.created_at ? new Date(m.created_at).toLocaleString("es") : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
