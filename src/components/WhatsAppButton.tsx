import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { waLink } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  phone?: string | null;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  label?: string;
}

export function WhatsAppButton({
  phone,
  size = "sm",
  variant = "outline",
  className,
  label = "Contactar por WhatsApp",
}: Props) {
  const href = waLink(phone);
  if (!href) return null;
  return (
    <Button
      asChild
      size={size}
      variant={variant}
      className={cn(
        "border-[color:var(--brand-green)]/40 text-[color:var(--brand-blue)] hover:bg-[color:var(--brand-green)]/10",
        className,
      )}
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-4 w-4 mr-1.5" />
        {label}
      </a>
    </Button>
  );
}
