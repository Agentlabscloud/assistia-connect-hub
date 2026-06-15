import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { supabase } from "@/lib/supabase";
import { AppLayout } from "@/components/AppLayout";
import { LoadingState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppGate,
});

interface CompanyStatusRow {
  company_id: string | null;
  company_name: string | null;
  company_email: string | null;
  company_status: string | null;
  onboarding_status: string | null;
}

function AppGate() {
  const { session, loading, signOut } = useAuth();
  const { loading: loadingCompany, preparingAccount, companyId } = useCompany();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [loading, session, navigate]);

  const statusQ = useQuery({
    queryKey: ["company-status-guard", session?.user.id],
    enabled: !!session?.user.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_company_status");
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as CompanyStatusRow | null;
      return row ?? null;
    },
  });

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[color:var(--brand-ivory)]">
        <LoadingState />
      </div>
    );
  }

  if (statusQ.isLoading || loadingCompany || preparingAccount || !companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[color:var(--brand-ivory)]">
        <LoadingState
          message={preparingAccount || !companyId ? "Estamos preparando tu cuenta…" : "Cargando…"}
        />
      </div>
    );
  }

  if (statusQ.isError || !statusQ.data || !statusQ.data.company_id) {
    return (
      <BlockedScreen
        title="No pudimos cargar tu empresa."
        message="Intenta cerrar sesión y volver a entrar. Si el problema persiste, contacta soporte."
        onSignOut={async () => {
          qc.clear();
          await signOut();
          navigate({ to: "/login", replace: true });
        }}
      />
    );
  }

  if (statusQ.data.company_status !== "active") {
    return (
      <BlockedScreen
        title="Tu cuenta está suspendida."
        message="Contacta soporte para reactivar tu servicio."
        primaryLabel="Contactar soporte"
        primaryHref="mailto:soporte@agentlabs.cloud"
        onSignOut={async () => {
          qc.clear();
          await signOut();
          navigate({ to: "/login", replace: true });
        }}
      />
    );
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

function BlockedScreen({
  title,
  message,
  primaryLabel,
  primaryHref,
  onSignOut,
}: {
  title: string;
  message: string;
  primaryLabel?: string;
  primaryHref?: string;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--brand-ivory)] p-6">
      <div className="max-w-md w-full bg-white border rounded-2xl shadow-sm p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-[color:var(--destructive)]/10 flex items-center justify-center mb-4">
          <ShieldAlert className="h-6 w-6 text-[color:var(--destructive)]" />
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{message}</p>
        <div className="mt-6 flex flex-col gap-2">
          {primaryLabel && primaryHref && (
            <Button asChild>
              <a href={primaryHref}>{primaryLabel}</a>
            </Button>
          )}
          <Button variant="outline" onClick={() => void onSignOut()}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
