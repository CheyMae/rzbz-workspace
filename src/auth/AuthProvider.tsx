import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Membership = 'unknown' | 'member' | 'not-member';

interface AuthState {
  loading: boolean;
  session: Session | null;
  membership: Membership;
  /** Set when the user arrived from an invite or reset link and still needs a password. */
  needsPassword: boolean;
  /** When this user was last here before now (for the Welcome back recap). */
  previousVisit: Date | null;
  clearNeedsPassword: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Invite and recovery links land with "type=invite" / "type=recovery" in the URL hash.
const arrivedFromLink = /type=(invite|recovery)/.test(window.location.hash);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership>('unknown');
  const [needsPassword, setNeedsPassword] = useState(arrivedFromLink);
  const [previousVisit, setPreviousVisit] = useState<Date | null>(null);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Once signed in: confirm this email is on the members list, then record the visit.
  useEffect(() => {
    if (!supabase || !session) { setMembership('unknown'); return; }
    let cancelled = false;
    (async () => {
      const { data: isMember } = await supabase.rpc('is_member');
      if (cancelled) return;
      setMembership(isMember ? 'member' : 'not-member');
      if (isMember) {
        const { data: prev } = await supabase.rpc('touch_last_seen');
        if (!cancelled) setPreviousVisit(prev ? new Date(prev as string) : null);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user.id]);

  const value: AuthState = {
    loading, session, membership, needsPassword, previousVisit,
    clearNeedsPassword: () => setNeedsPassword(false),
    signOut: async () => { await supabase?.auth.signOut(); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
