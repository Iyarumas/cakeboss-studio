import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { authMessage, supabase } from '../lib/supabase';

type Result = { ok: true } | { ok: false; error: string };

interface Auth {
  session: Session | null;
  user: User | null;
  /** true until the saved session (if any) has been read */
  loading: boolean;
  /** true after opening the link from the "esqueci minha senha" e-mail */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<Result>;
  /** `needsConfirmation` when the account must confirm the e-mail before the first login */
  signUp: (input: { name: string; email: string; password: string }) => Promise<{ ok: true; needsConfirmation: boolean } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
}

const AuthCtx = createContext<Auth | null>(null);

const origin = () => window.location.origin;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<Auth>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      recovering,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return error ? { ok: false, error: authMessage(error) } : { ok: true };
      },
      signUp: async ({ name, email, password }) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: `${origin()}/` },
        });
        if (error) return { ok: false, error: authMessage(error) };
        // with e-mail confirmation on, Supabase returns a user but no session; an existing e-mail comes back with no identities
        if (data.user && data.user.identities?.length === 0) return { ok: false, error: authMessage({ code: 'user_already_exists' }) };
        return { ok: true, needsConfirmation: !data.session };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      sendReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origin()}/redefinir-senha` });
        return error ? { ok: false, error: authMessage(error) } : { ok: true };
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return { ok: false, error: authMessage(error) };
        setRecovering(false);
        return { ok: true };
      },
    }),
    [session, loading, recovering],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const a = useContext(AuthCtx);
  if (!a) throw new Error('useAuth fora do AuthProvider');
  return a;
}
