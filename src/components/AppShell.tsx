import { useLayoutEffect } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TooltipLayer } from './kit';

export function AppShell() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  // Opening a page (a project from Home, a sidebar link…) starts at the top.
  // Back/Forward ('POP') is left alone so the browser can return you to where you were.
  useLayoutEffect(() => { if (navType !== 'POP') window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="app">
      <Sidebar />
      <main className="main"><Outlet /></main>
      <TooltipLayer />
    </div>
  );
}
