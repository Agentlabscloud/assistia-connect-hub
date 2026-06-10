import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Bot,
  MessageCircle,
  Users,
  MessagesSquare,
  Gauge,
  CreditCard,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assistant", label: "Assistia", icon: Bot },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/conversations", label: "Conversaciones", icon: MessagesSquare },
  { to: "/usage", label: "Uso mensual", icon: Gauge },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/notifications", label: "Notificaciones", icon: Bell },
  { to: "/settings", label: "Configuración", icon: Settings },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const { company } = useCompany();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const SidebarInner = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between px-6 py-5">
        <Logo variant="light" />
        <button
          className="lg:hidden text-sidebar-foreground"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-white border-l-2 border-[color:var(--brand-green)]"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 text-xs text-sidebar-foreground/60 border-t border-sidebar-border">
        Atiende, responde y vende por WhatsApp con IA.
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[color:var(--brand-ivory)]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">{SidebarInner}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64">{SidebarInner}</div>
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden p-2 -ml-2"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">
                {company?.name || "Mi empresa"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {user?.email}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Button>
        </header>
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
