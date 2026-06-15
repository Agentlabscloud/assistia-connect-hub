import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "full" | "icon";
}

export function Logo({ className, variant = "full" }: LogoProps) {
  const src = variant === "icon" ? "/agentlabs-cloud-icon.png" : "/agentlabs-cloud-logo.png";
  return (
    <img
      src={src}
      alt="AgentLabs Cloud"
      className={cn(
        "object-contain",
        variant === "icon" ? "h-9 w-9" : "h-9 w-auto max-w-full",
        className,
      )}
    />
  );
}
