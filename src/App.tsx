import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { Home } from './pages/Home';
import { Placeholder } from './pages/Placeholder';
import { SignIn } from './pages/SignIn';
import { SetPassword } from './pages/SetPassword';
import { NoAccess } from './pages/NoAccess';
import { Settings } from './pages/Settings';
import { allNav } from './nav';

const byPath = Object.fromEntries(allNav.map((n) => [n.path, n]));

// Local design preview only: /?shell shows the signed-in layout without a database.
// import.meta.env.DEV is false in the published build, so this never ships.
const shellPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('shell');

function Gate() {
  const { loading, session, membership, needsPassword } = useAuth();
  if (shellPreview) return <Shell />;
  if (loading || (session && membership === 'unknown')) return <div className="loading" aria-busy="true" />;
  if (!session) return <SignIn />;
  if (needsPassword) return <SetPassword />;
  if (membership === 'not-member') return <NoAccess />;
  return <Shell />;
}

function Shell() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="projects" element={<Placeholder item={byPath['/projects']} table="projects" filter={{ is_archived: false }} />} />
        <Route path="sprints" element={<Placeholder item={byPath['/sprints']} table="sprints" />} />
        <Route path="library" element={<Placeholder item={byPath['/library']} table="library_items" />} />
        <Route path="products" element={<Placeholder item={byPath['/products']} table="products" />} />
        <Route path="hr" element={<Placeholder item={byPath['/hr']} />} />
        <Route path="hiring" element={<Placeholder item={byPath['/hiring']} />} />
        <Route path="analytics" element={<Placeholder item={byPath['/analytics']} />} />
        <Route path="archive" element={<Placeholder item={byPath['/archive']} table="tasks" filter={{ is_archived: true }} />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider><Gate /></AuthProvider>
    </BrowserRouter>
  );
}
