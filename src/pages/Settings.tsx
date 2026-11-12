import { Monitor, Moon, Sun } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { ViewTabs } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { useData } from '../lib/data';
import { useTheme, type Theme } from '../lib/theme';

export function Settings() {
  const { session, signOut } = useAuth();
  const { ws, updatePerson } = useData();
  const [theme, setTheme] = useTheme();
  const email = session?.user.email ?? '';
  const people = ws.people.slice().sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || a.name.localeCompare(b.name));
  return (
    <div className="page">
      <PageHeader emoji="⚙️" title="Settings" subtitle="Your account, how the site looks, and the team list." />

      <section className="settings-section">
        <h2 className="t-title-subsection">Account</h2>
        <div className="settings-row">
          <Avatar name={email || '?'} size={32} />
          <div><div className="t-body-emphasis">{email || 'Signed in'}</div><div className="t-caption muted">Signed in</div></div>
          <Button variant="secondary" onClick={signOut}>Sign out</Button>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="t-title-subsection">Appearance</h2>
        <p className="t-caption muted">Saved on this browser. System follows your computer’s light or dark setting.</p>
        <ViewTabs<Theme> value={theme} onChange={setTheme} tabs={[
          { value: 'light', label: 'Light', icon: <Sun size={14} /> },
          { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
          { value: 'system', label: 'System', icon: <Monitor size={14} /> },
        ]} />
      </section>

      <section className="settings-section">
        <h2 className="t-title-subsection">Team</h2>
        <p className="t-caption muted">On the team: shows up in the pickers (turning someone off keeps their past work). Designer: can be a project’s lead or support; everyone else can be a project owner.</p>
        <div className="team-list" role="table">
          <div className="team-row t-caption muted" role="row"><span>Person</span><span>On the team</span><span>Designer</span></div>
          {people.map((p) => (
            <div key={p.id} className="team-row t-body" role="row">
              <span className="people"><Avatar name={p.name} size={20} /><span className={p.active === false ? 'muted' : ''}>{p.name}</span></span>
              <input type="checkbox" aria-label={`${p.name} is on the team`} checked={p.active !== false} onChange={(e) => updatePerson(p.id, { active: e.target.checked })} />
              <input type="checkbox" aria-label={`${p.name} is a designer`} checked={!!p.is_designer} onChange={(e) => updatePerson(p.id, { is_designer: e.target.checked })} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
