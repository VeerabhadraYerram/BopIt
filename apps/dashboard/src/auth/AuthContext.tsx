import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { dashboardAuthApi, supabase, supabaseConfigured } from '../lib/supabase';

export type DashboardRole = 'creator' | 'retailer';
export interface DashboardProfile {
  userId: string;
  email: string | null;
  role: DashboardRole;
  displayName: string;
  profile: Record<string, unknown>;
}
type AuthStatus = 'loading' | 'signed_out' | 'authenticated' | 'configuration_error';
interface AuthValue {
  status: AuthStatus;
  profile: DashboardProfile | null;
  error: string;
  signIn(email: string, password: string): Promise<void>;
  register(role: DashboardRole, email: string, password: string, displayName: string): Promise<boolean>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
  updateProfile(patch: Record<string, unknown>): Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

async function profileRequest(session: Session): Promise<DashboardProfile> {
  const response = await fetch(`${dashboardAuthApi}/profile`, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.data?.profile || !['creator', 'retailer'].includes(body.data.role)) {
    throw new Error(response.status === 401 ? 'Your session expired. Sign in again.' : body?.error?.message || 'Your dashboard profile is unavailable.');
  }
  return body.data as DashboardProfile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabaseConfigured ? 'loading' : 'configuration_error');
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [error, setError] = useState('');

  const acceptSession = useCallback(async (session: Session | null) => {
    if (!session || !supabase) {
      setProfile(null); setStatus('signed_out'); return;
    }
    try {
      const next = await profileRequest(session);
      setProfile(next); setError(''); setStatus('authenticated');
    } catch (cause) {
      setProfile(null); setStatus('signed_out');
      setError(cause instanceof Error ? cause.message : 'Dashboard session is invalid.');
      await supabase.auth.signOut();
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) void acceptSession(data.session); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => { if (active) void acceptSession(session); });
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [acceptSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured for this dashboard.');
    setError('');
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) throw authError;
    await acceptSession(data.session);
  }, [acceptSession]);

  const register = useCallback(async (role: DashboardRole, email: string, password: string, displayName: string) => {
    if (!supabase) throw new Error('Supabase is not configured for this dashboard.');
    if (!['creator', 'retailer'].includes(role)) throw new Error('Choose Creator or Retailer registration.');
    setError('');
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { bopit_role: role, display_name: displayName.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` }
    });
    if (authError) throw authError;
    if (data.session) await acceptSession(data.session);
    return !data.session;
  }, [acceptSession]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setProfile(null); setError(''); setStatus('signed_out');
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    await acceptSession(data.session);
  }, [acceptSession]);

  const updateProfile = useCallback(async (patch: Record<string, unknown>) => {
    if (!supabase) throw new Error('Supabase is not configured for this dashboard.');
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('Your session expired. Sign in again.');
    const response = await fetch(`${dashboardAuthApi}/profile`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.data?.profile) throw new Error(body?.error?.message || 'Profile update failed.');
    setProfile(body.data as DashboardProfile);
  }, []);

  const value = useMemo(() => ({ status, profile, error, signIn, register, signOut, refreshProfile, updateProfile }), [status, profile, error, signIn, register, signOut, refreshProfile, updateProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
