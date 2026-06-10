import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Profile, Company } from "@/lib/types";

interface CompanyCtx {
  profile: Profile | null;
  company: Company | null;
  companyId: string | null;
  loading: boolean;
  preparingAccount: boolean;
  refetch: () => Promise<void>;
}

const Ctx = createContext<CompanyCtx>({
  profile: null,
  company: null,
  companyId: null,
  loading: true,
  preparingAccount: false,
  refetch: async () => {},
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparingAccount, setPreparingAccount] = useState(false);

  const fetchAll = async () => {
    if (!user) {
      setProfile(null);
      setCompany(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let attempts = 0;
    let prof: Profile | null = null;
    while (attempts < 6 && !prof) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        prof = data as Profile;
        break;
      }
      attempts++;
      setPreparingAccount(true);
      await new Promise((r) => setTimeout(r, 1500));
    }
    setPreparingAccount(false);

    if (!prof) {
      setProfile(null);
      setCompany(null);
      setLoading(false);
      return;
    }
    setProfile(prof);
    const { data: comp } = await supabase
      .from("companies")
      .select("*")
      .eq("id", prof.company_id)
      .maybeSingle();
    setCompany((comp as Company) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  return (
    <Ctx.Provider
      value={{
        profile,
        company,
        companyId: profile?.company_id ?? null,
        loading,
        preparingAccount,
        refetch: fetchAll,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useCompany = () => useContext(Ctx);
