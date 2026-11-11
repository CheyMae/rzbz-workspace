import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { TextInput } from '../components/TextInput';
import { supabase, isConfigured } from '../lib/supabase';

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="auth-emoji" aria-hidden>🗂️</span>
        {children}
      </div>
    </div>
  );
}

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message === 'Invalid login credentials' ? 'That email and password don’t match.' : error.message);
  }

  async function reset() {
    if (!supabase || !email.trim()) { setError('Type your email first, then choose Forgot password.'); return; }
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + import.meta.env.BASE_URL });
    setResetSent(true); setError(null);
  }

  return (
    <AuthCard>
      <h1 className="t-title-section">RZBZ Design Team</h1>
      <p className="t-body muted">This workspace is private. Sign in to see projects, sprints and the library.</p>
      {!isConfigured ? (
        <div className="callout callout-yellow t-body">
          <span aria-hidden>🔌</span>
          <span>Not connected to the database yet. Add the Supabase URL and anon key to <code>.env.local</code>.</span>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <TextInput label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextInput label="Password" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} error={error ?? undefined} />
          <Button type="submit" size="md" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          <button type="button" className="link-button t-caption" onClick={reset}>Forgot password?</button>
          {resetSent && <p className="t-caption muted">If that email has access, a reset link is on its way.</p>}
        </form>
      )}
      <p className="t-caption muted">Access is by invitation only.</p>
    </AuthCard>
  );
}
