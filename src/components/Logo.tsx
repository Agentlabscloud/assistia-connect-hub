import { cn } from "@/lib/utils";
import logoFull from "@/assets/agentlabs-cloud-logo.png.asset.json";
import logoIcon from "@/assets/agentlabs-cloud-icon.png.asset.json";

interface LogoProps {
  className?: string;
  variant?: "full" | "icon";
}

export function Logo({ className, variant = "full" }: LogoProps) {
  const src = variant === "icon" ? logoIcon.url : logoFull.url;
  return (
    <img
      src={src}
      alt="AgentLabs Cloud"
      className={cn(variant === "icon" ? "h-9 w-9" : "h-9 w-auto", className)}
    />
  );
}
