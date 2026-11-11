import { Button } from '../components/Button';
import { useAuth } from '../auth/AuthProvider';
import { AuthCard } from './SignIn';

export function NoAccess() {
  const { session, signOut } = useAuth();
  return (
    <AuthCard>
      <h1 className="t-title-section">No access yet</h1>
      <p className="t-body muted">{session?.user.email} isn’t on the members list for this workspace. Ask the workspace owner to add you.</p>
      <Button variant="secondary" size="md" onClick={signOut}>Sign out</Button>
    </AuthCard>
  );
}
