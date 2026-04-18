import { useState } from 'react';
import type { Theme } from '../App';
import type { Lang, T } from '../i18n';

type LoginView = 'login' | 'register' | 'about';

interface LoginProps {
  onLogin: (username: string) => void;
  theme: Theme;
  onThemeToggle: () => void;
  lang: Lang;
  onLangToggle: () => void;
  t: T;
}

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

export default function Login({
  onLogin,
  theme,
  onThemeToggle,
  lang,
  onLangToggle,
  t,
}: LoginProps): React.JSX.Element {
  const [view, setView] = useState<LoginView>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (view === 'login') {
      if (username === 'kinga' && password === '123') {
        onLogin(username);
      } else {
        setError(t.loginErrorInvalid);
      }
    } else {
      setError(t.loginErrorRegister);
    }
  };

  return (
    <div className={`login-screen ${theme}`}>
      <div className="login-screen-controls">
        <button className="login-control lang-toggle" onClick={onLangToggle}>
          <span className={lang === 'en' ? 'lang-active' : ''}>EN</span>
          <span className="lang-sep">/</span>
          <span className={lang === 'pl' ? 'lang-active' : ''}>PL</span>
        </button>
        <button
          className="login-control theme-toggle"
          onClick={onThemeToggle}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
      </div>

      <div className="login-box">
        <div className="login-tabs">
          <button
            className={`login-tab ${view === 'login' ? 'login-tab--active' : ''}`}
            onClick={() => {
              setView('login');
              setError('');
            }}
          >
            {t.loginTabLogin}
          </button>
          <button
            className={`login-tab ${view === 'register' ? 'login-tab--active' : ''}`}
            onClick={() => {
              setView('register');
              setError('');
            }}
          >
            {t.loginTabRegister}
          </button>
          <button
            className={`login-tab ${view === 'about' ? 'login-tab--active' : ''}`}
            onClick={() => {
              setView('about');
              setError('');
            }}
          >
            {t.loginTabAbout}
          </button>
        </div>

        <div className="login-logo">
          <div className="login-logo-mark">
            <span className="logo-p">P</span>
            <span className="logo-dot">·</span>
            <span className="logo-ly">ly</span>
          </div>
        </div>
        <h1 className="login-title">{t.loginTitle}</h1>

        {view === 'about' ? (
          <div className="login-about">
            <p>{t.loginAbout}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <input
              className="login-input"
              type="text"
              placeholder={t.loginUsername}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            <input
              className="login-input"
              type="password"
              placeholder={t.loginPassword}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {view === 'register' && (
              <input className="login-input" type="password" placeholder={t.loginConfirmPassword} />
            )}
            {error && <p className="login-error">{error}</p>}
            <button className="login-btn" type="submit">
              {view === 'register' ? t.loginBtnRegister : t.loginBtnLogin}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
