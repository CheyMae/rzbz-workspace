export function PageHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <header className="page-header">
      <span className="page-emoji" aria-hidden>{emoji}</span>
      <h1 className="t-title-screen">{title}</h1>
      {subtitle && <p className="t-body muted">{subtitle}</p>}
    </header>
  );
}
