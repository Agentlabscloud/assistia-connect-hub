import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { LoadingState } from "@/components/ui-bits";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    navigate({ to: session ? "/dashboard" : "/login", replace: true });
  }, [loading, session, navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--brand-ivory)]">
      <LoadingState />
    </div>
  );
}
