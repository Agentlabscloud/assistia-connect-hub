import { StatusBadge } from "@/components/ui-bits";
import { tLeadStatus } from "@/lib/i18n";

export function LeadBadge({ lead }: { lead: string }) {
  const l = lead.toLowerCase();
  const tone =
    l === "hot"
      ? "failed"
      : l === "needs_human"
      ? "pending"
      : l === "interested"
      ? "active"
      : l === "closed"
      ? "draft"
      : "pending";
  return <StatusBadge status={tone}>{tLeadStatus(lead)}</StatusBadge>;
}
