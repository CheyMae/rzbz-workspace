import { useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { DataProvider } from './lib/data';
import { Home } from './pages/Home';
import { Projects } from './pages/Projects';
import { ProjectPage } from './pages/ProjectPage';
import { Sprints } from './pages/Sprints';
import { SprintPage } from './pages/SprintPage';
import { Library } from './pages/Library';
import { Products } from './pages/Products';
import { ProductPage } from './pages/ProductPage';
import { Archive } from './pages/Archive';
import { Welcome } from './pages/Welcome';
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
const signInPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('signin');
const setPasswordPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('setpassword');
const noAccessPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('noaccess');

/** After this many days away, the first page you see is the Welcome back recap. */
const RECAP_AFTER_DAYS = 3;

function Gate() {
  const { loading, session, membership, needsPassword } = useAuth();
  if (signInPreview) return <SignIn />;
  if (setPasswordPreview) return <SetPassword />;
  if (noAccessPreview) return <NoAccess />;
  if (shellPreview) return <DataProvider><Shell /></DataProvider>;
  if (loading || (session && membership === 'unknown')) return <div className="loading" aria-busy="true" />;
  if (!session) return <SignIn />;
  if (needsPassword) return <SetPassword />;
  if (membership === 'not-member') return <NoAccess />;
  return <DataProvider><Shell /></DataProvider>;
}

function RecapRedirect() {
  const { previousVisit } = useAuth();
  const nav = useNavigate();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !previousVisit) return;
    done.current = true;
    if (Date.now() - previousVisit.getTime() > RECAP_AFTER_DAYS * 86_400_000) nav('/welcome');
  }, [previousVisit]);
  return null;
}

function Shell() {
  return (
    <>
      <RecapRedirect />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="welcome" element={<Welcome />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectPage />} />
          <Route path="sprints" element={<Sprints />} />
          <Route path="sprints/:id" element={<SprintPage />} />
          <Route path="library" element={<Library />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductPage />} />
          <Route path="hr" element={<Placeholder item={byPath['/hr']} />} />
          <Route path="hiring" element={<Placeholder item={byPath['/hiring']} />} />
          <Route path="analytics" element={<Placeholder item={byPath['/analytics']} />} />
          <Route path="archive" element={<Archive />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider><Gate /></AuthProvider>
    </BrowserRouter>
  );
}
