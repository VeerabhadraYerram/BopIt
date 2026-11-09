import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth, type DashboardRole } from './AuthContext';
import { supabaseConfigured } from '../lib/supabase';

function AuthFrame({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <main className="auth-page"><section className="auth-card"><a className="auth-brand" href="/">bopit</a><span className="auth-eyebrow">{eyebrow}</span><h1>{title}</h1>{children}</section></main>;
}

export function LoginPage() {
  const { status, profile, signIn, error: sessionError } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (status === 'authenticated' && profile) return <Navigate to={profile.role === 'creator' ? '/creator' : '/retail'} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await signIn(email, password); navigate('/'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in failed.'); }
    finally { setBusy(false); }
  }
  return <AuthFrame eyebrow="CREATOR & RETAILER WORKSPACE" title="Sign in to BopIt">
    {!supabaseConfigured && <p className="auth-alert" role="alert">Supabase is not configured. Copy the dashboard env example and add your project URL and publishable anon key.</p>}
    {(error || sessionError) && <p className="auth-alert" role="alert">{error || sessionError}</p>}
    <form onSubmit={submit} className="auth-form">
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button disabled={busy || !supabaseConfigured}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <p className="auth-links">New to BopIt? <Link to="/register/creator">Create a Creator account</Link> or <Link to="/register/retailer">create a Retailer account</Link>.</p>
  </AuthFrame>;
}

export function RegisterPage({ role }: { role: DashboardRole }) {
  const { status, profile, register } = useAuth();
  const [displayName, setDisplayName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (status === 'authenticated' && profile) return <Navigate to={profile.role === 'creator' ? '/creator' : '/retail'} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const confirmationRequired = await register(role, email, password, displayName);
      setMessage(confirmationRequired ? 'Check your email to confirm your account. Then sign in to open your dashboard.' : 'Your account is ready.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Registration failed.'); }
    finally { setBusy(false); }
  }
  return <AuthFrame eyebrow={`${role.toUpperCase()} ACCOUNT`} title={`Create a ${role === 'creator' ? 'Creator' : 'Retailer'} account`}>
    {!supabaseConfigured && <p className="auth-alert" role="alert">Supabase is not configured. Registration is disabled until the project URL and publishable anon key are set.</p>}
    {message && <p className="auth-success" role="status">{message}</p>}{error && <p className="auth-alert" role="alert">{error}</p>}
    <form onSubmit={submit} className="auth-form">
      <label>{role === 'creator' ? 'Creator name' : 'Business name'}<input autoComplete="organization" required minLength={1} maxLength={120} value={displayName} onChange={e => setDisplayName(e.target.value)} /></label>
      <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e => setPassword(e.target.value)} /><small>Use at least 12 characters. Supabase applies the project’s password and email-confirmation settings.</small></label>
      <button disabled={busy || !supabaseConfigured}>{busy ? 'Creating account…' : `Create ${role} account`}</button>
    </form>
    <p className="auth-links">Already registered? <Link to="/login">Sign in</Link>.</p>
  </AuthFrame>;
}

export function AuthCallbackPage() {
  return <AuthFrame eyebrow="ACCOUNT CONFIRMATION" title="Confirming your account"><p>Supabase is validating your email confirmation. You can continue after the session is checked.</p><Link to="/">Continue to dashboard</Link></AuthFrame>;
}
