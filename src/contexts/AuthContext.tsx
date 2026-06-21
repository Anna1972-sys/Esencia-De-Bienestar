import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, isAdmin: false, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadRole = (userId: string) => {
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .then(({ data, error }) => {
          if (cancelled) return;
          // eslint-disable-next-line no-console
          console.log("[Auth] loadRole result", { userId, data, error });
          setIsAdmin(!!data?.some((r: any) => r.role === "admin"));
        });
    };

    // 1) Register listener FIRST (synchronous callback, no awaits inside)
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      // eslint-disable-next-line no-console
      console.log("[Auth] onAuthStateChange", { event, hasSession: !!sess, userId: sess?.user?.id, hydrated: hydratedRef.current });

      // Ignore the very first INITIAL_SESSION fire — getSession() below is authoritative
      if (event === "INITIAL_SESSION" && !hydratedRef.current) {
        // eslint-disable-next-line no-console
        console.log("[Auth] ignored INITIAL_SESSION pre-hydration");
        return;
      }

      // Only treat null sessions as logout on explicit SIGNED_OUT to avoid transient
      // nulls during token refresh from kicking the user back to /login.
      if (!sess && event !== "SIGNED_OUT") {
        // eslint-disable-next-line no-console
        console.warn("[Auth] ignored null session for event", event);
        return;
      }

      setSession(sess);
      if (sess?.user) {
        setTimeout(() => loadRole(sess.user.id), 0);
      } else {
        setIsAdmin(false);
      }
    });

    // 2) Then hydrate from storage
    supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      // eslint-disable-next-line no-console
      console.log("[Auth] getSession resolved", { hasSession: !!data.session, userId: data.session?.user?.id, error });
      hydratedRef.current = true;
      setSession(data.session);
      if (data.session?.user) loadRole(data.session.user.id);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider value={{
      user: session?.user ?? null,
      session,
      loading,
      isAdmin,
      signOut: async () => { await supabase.auth.signOut(); },
    }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
