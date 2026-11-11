import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { TextInput } from '../components/TextInput';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AuthCard } from './SignIn';

/** Shown after following an invite or password-reset link. */
export function SetPassword() {
  const { clearNeedsPassword, session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 10) { setError('Use at least 10 characters.'); return; }
    if (password !== confirm) { setError('The two passwords don’t match.'); return; }
    setBusy(true);
    const { error } = await supabase!.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    window.history.replaceState(null, '', window.location.pathname);
    clearNeedsPassword();
  }

  return (
    <AuthCard>
      <h1 className="t-title-section">Set your password</h1>
      <p className="t-body muted">For {session?.user.email}. You’ll use it with your email to sign in.</p>
      <form className="auth-form" onSubmit={submit}>
        <TextInput label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <TextInput label="Type it again" type="password" autoComplete="new-password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} error={error ?? undefined} />
        <Button type="submit" size="md" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</Button>
      </form>
    </AuthCard>
  );
}
