import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../auth/AuthProvider';

export function Settings() {
  const { session, signOut } = useAuth();
  const email = session?.user.email ?? '';
  return (
    <div className="page">
      <PageHeader emoji="⚙️" title="Settings" subtitle="Your account." />
      <div className="settings-row">
        <Avatar name={email} size={32} />
        <div><div className="t-body-emphasis">{email}</div><div className="t-caption muted">Signed in</div></div>
        <Button variant="secondary" onClick={signOut}>Sign out</Button>
      </div>
    </div>
  );
}
