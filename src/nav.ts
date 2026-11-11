/** Sidebar order follows the brief: projects, tasks and sprints first, then the library, then the rest. */
export interface NavItem { path: string; label: string; emoji: string; blurb: string }

export const mainNav: NavItem[] = [
  { path: '/', label: 'Home', emoji: '🏠', blurb: 'Projects in the open sprints.' },
  { path: '/projects', label: 'Projects', emoji: '📁', blurb: 'Every project, grouped by product.' },
  { path: '/sprints', label: 'Sprints', emoji: '🏃', blurb: 'Two-week sprints, open until someone closes them.' },
  { path: '/library', label: 'Library', emoji: '📚', blurb: 'Figma files, docs and templates.' },
  { path: '/products', label: 'Products', emoji: '📦', blurb: 'The products the team designs for.' },
];

export const teamNav: NavItem[] = [
  { path: '/hr', label: 'HR Stuff', emoji: '🧾', blurb: 'Empty for now.' },
  { path: '/hiring', label: 'Hiring People', emoji: '🤝', blurb: 'Empty for now.' },
  { path: '/analytics', label: 'Analytics', emoji: '📊', blurb: 'Workload and progress across the team.' },
];

export const footerNav: NavItem[] = [
  { path: '/archive', label: 'Archive', emoji: '🗄️', blurb: 'Past projects and tasks from 2023 onwards.' },
  { path: '/settings', label: 'Settings', emoji: '⚙️', blurb: 'Your account.' },
];

export const allNav = [...mainNav, ...teamNav, ...footerNav];
