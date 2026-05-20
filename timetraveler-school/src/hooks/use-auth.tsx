import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/constants";

interface Profile {
  id: string;
  school_id: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface School {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  school: School | null;
  roles: AppRole[];
  schoolId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (r: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: prof }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id, school_id, full_name, email, avatar_url").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(prof ?? null);
    setRoles((r ?? []).map((x) => x.role as AppRole));

    if (prof?.school_id) {
      const { data: sc } = await supabase
        .from("schools")
        .select("id, name, logo_url, phone, address")
        .eq("id", prof.school_id)
        .maybeSingle();
      setSchool(sc ?? null);
    } else {
      setSchool(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setSchool(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadProfile(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user, session, profile, school, roles,
    schoolId: profile?.school_id ?? null,
    loading,
    signOut: async () => { await supabase.auth.signOut(); },
    refresh: async () => { if (user) await loadProfile(user.id); },
    hasRole: (r) => roles.includes(r),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
