import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "light" | "dark";
  textOnly?: boolean;
}

/**
 * AgentLabs Cloud logo.
 * Drop the official PNG at src/assets/agentlabs-cloud-logo.png and
 * uncomment the import to use it. Falls back to wordmark text.
 */
// import logoUrl from "@/assets/agentlabs-cloud-logo.png";
const logoUrl: string | undefined = undefined;

export function Logo({ className, variant = "dark", textOnly = false }: LogoProps) {
  if (logoUrl && !textOnly) {
    return (
      <img
        src={logoUrl}
        alt="AgentLabs Cloud"
        className={cn("h-8 w-auto", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "font-bold tracking-tight text-lg",
        variant === "light" ? "text-white" : "text-[color:var(--brand-blue)]",
        className,
      )}
    >
      AgentLabs <span className="font-semibold opacity-80">Cloud</span>
    </span>
  );
}
