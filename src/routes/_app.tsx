import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { AppLayout } from "@/components/AppLayout";
import { LoadingState } from "@/components/ui-bits";

export const Route = createFileRoute("/_app")({
  component: AppGate,
});

function AppGate() {
  const { session, loading } = useAuth();
  const { loading: loadingCompany, preparingAccount, companyId } = useCompany();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[color:var(--brand-ivory)]">
        <LoadingState />
      </div>
    );
  }

  if (loadingCompany || preparingAccount || !companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[color:var(--brand-ivory)]">
        <LoadingState
          message={preparingAccount || !companyId ? "Estamos preparando tu cuenta…" : "Cargando…"}
        />
      </div>
    );
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
