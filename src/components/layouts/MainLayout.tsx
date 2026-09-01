import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';
import { LANGUAGES } from '@/lib/i18n';

const navItems = [
  { path: '/', key: 'nav.projects' },
  { path: '/map-editor', key: 'nav.map' },
  { path: '/rule-editor', key: 'nav.rules' },
  { path: '/game-runner', key: 'nav.run' },
  { path: '/replay', key: 'nav.replay' },
  { path: '/analytics', key: 'nav.analytics' },
  { path: '/dev-tools', key: 'nav.tools' },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { currentProject, devMode, language, setLanguage, t } = useProject();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside className={`hidden md:flex flex-col w-44 shrink-0 bg-sidebar border-r-2 border-sidebar-border`}>
        {/* Logo */}
        <div className="p-3 border-b-2 border-sidebar-border">
          <div className="text-primary text-xs font-bold uppercase tracking-wider pixel-blink inline">▶</div>
          <span className="text-foreground text-xs font-bold ml-2 uppercase">{t('app.title')}</span>
        </div>

        {/* Project indicator */}
        {currentProject && (
          <div className="px-3 py-2 border-b border-sidebar-border">
            <div className="text-muted-foreground text-[10px] uppercase">{t('common.current_project')}</div>
            <div className="text-accent text-xs truncate font-bold">{currentProject.name}</div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-2">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center px-3 py-2 text-xs uppercase font-bold
                  border-l-4 transition-none
                  ${active
                    ? 'border-primary text-primary bg-sidebar-accent'
                    : 'border-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:border-muted-foreground'
                  }
                `}
              >
                {active && <span className="mr-1 text-primary">▶</span>}
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        {/* Dev mode indicator */}
        {devMode && (
          <div className="px-3 py-2 border-t border-sidebar-border">
            <span className="text-accent text-[10px] uppercase font-bold pixel-blink">{t('common.dev_mode')}</span>
          </div>
        )}

        {/* Language switcher */}
        <div className="px-3 py-2 border-t-2 border-sidebar-border flex gap-1">
          {LANGUAGES.map(l => (
            <button
              key={l.value}
              onClick={() => setLanguage(l.value)}
              className={`text-[10px] uppercase font-bold px-1 py-0.5 pixel-btn
                ${language === l.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}
              `}
            >
              {l.value}
            </button>
          ))}
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b-2 border-sidebar-border flex items-center px-3 h-10">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-foreground font-bold text-sm mr-3">☰</button>
        <span className="text-primary font-bold text-xs uppercase">{t('app.title')}</span>
        {currentProject && <span className="text-accent text-xs ml-2 truncate">— {currentProject.name}</span>}
      </div>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/90" onClick={() => setMobileOpen(false)}>
          <div className="w-44 h-full bg-sidebar border-r-2 border-sidebar-border" onClick={e => e.stopPropagation()}>
            <div className="p-3 border-b-2 border-sidebar-border">
              <span className="text-primary font-bold text-xs uppercase">{t('app.title')}</span>
            </div>
            <nav className="py-2">
              {navItems.map(item => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center px-3 py-2 text-xs uppercase font-bold border-l-4 transition-none
                      ${active ? 'border-primary text-primary bg-sidebar-accent' : 'border-transparent text-sidebar-foreground hover:bg-sidebar-accent'}
                    `}
                  >
                    {active && <span className="mr-1">▶</span>}
                    {t(item.key)}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col md:pt-0 pt-10">
        {children}
      </div>
    </div>
  );
}
