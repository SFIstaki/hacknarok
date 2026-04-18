import Tips from '../pages/Tips';
import Camera from '../pages/Camera';
const TipsIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18h6M10 22h4M12 2a7 7 0 014.9 11.9c-.6.7-1 1.5-1 2.1H8.1c0-.6-.3-1.4-1-2.1A7 7 0 0112 2z" />
  </svg>
);
import { useState } from 'react';
import Home from '../pages/Home';
import Stats from '../pages/Stats';
import Settings from '../pages/Settings';
import type { Theme } from '../App';
import { translations, type Lang } from '../i18n';
import type { Page } from '../types';

interface LayoutProps {
  username: string;
  onLogout: () => void;
  theme: Theme;
  onThemeToggle: () => void;
  lang: Lang;
  onLangToggle: () => void;
}

const HomeIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
);
const StatsIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </svg>
);
const SettingsIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);
const CameraIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);
const LogoutIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const SunIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="18"
    height="18"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);
const MoonIcon = (): React.JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="18"
    height="18"
  >
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);

export default function Layout({
  username,
  onLogout,
  theme,
  onThemeToggle,
  lang,
  onLangToggle,
}: LayoutProps): React.JSX.Element {
  const [activePage, setActivePage] = useState<Page>('home');
  const t = translations[lang];

  const navItems: { id: Page; label: string; Icon: () => React.JSX.Element }[] = [
    { id: 'home', label: t.navHome, Icon: HomeIcon },
    { id: 'stats', label: t.navStats, Icon: StatsIcon },
    { id: 'tips', label: t.navTips, Icon: TipsIcon },
    { id: 'settings', label: t.navSettings, Icon: SettingsIcon },
    { id: 'camera', label: 'Camera', Icon: CameraIcon },
  ];

  const renderPage = (): React.JSX.Element => {
    switch (activePage) {
      case 'home':
        return <Home t={t} onNavigate={setActivePage} theme={theme} />;
      case 'stats':
        return <Stats t={t} />;
      case 'tips':
        return <Tips t={t} />;
      case 'settings':
        return <Settings t={t} />;
      case 'camera':
        return <Camera />;
      default:
        return <Home t={t} onNavigate={setActivePage} theme={theme} />;
    }
  };

  return (
    <div className={`app-shell ${theme}`}>
      <nav className="sidebar">
        <button className="sidebar-logo" onClick={() => setActivePage('home')}>
          <div className="sidebar-logo-mark">
            <span className="logo-p">P</span>
            <span className="logo-dot">·</span>
            <span className="logo-ly">ly</span>
          </div>
          <span className="logo-tooltip">Present.ly</span>
        </button>

        <ul className="sidebar-nav">
          {navItems.map(({ id, label, Icon }) => (
            <li key={id}>
              <button
                className={`nav-item ${activePage === id ? 'nav-item--active' : ''}`}
                onClick={() => setActivePage(id)}
              >
                <span className="nav-icon">
                  <Icon />
                </span>
                <span className="nav-tooltip">{label}</span>
              </button>
            </li>
          ))}
        </ul>

        <button className="nav-item nav-item--logout" onClick={onLogout}>
          <span className="nav-icon">
            <LogoutIcon />
          </span>
          <span className="nav-tooltip">{t.navLogout}</span>
        </button>
      </nav>

      <main className="main-content">
        <header className="main-header">
          <div className="header-left">
            <h1 className="greeting-name">Hello, {username}</h1>
            <p className="greeting-sub">{t.greetingSub}</p>
          </div>
          <div className="header-controls">
            <button className="lang-toggle" onClick={onLangToggle}>
              <span className={lang === 'en' ? 'lang-active' : ''}>EN</span>
              <span className="lang-sep">/</span>
              <span className={lang === 'pl' ? 'lang-active' : ''}>PL</span>
            </button>
            <button
              className="theme-toggle"
              onClick={onThemeToggle}
              title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
          </div>
        </header>
        {renderPage()}
      </main>
    </div>
  );
}
