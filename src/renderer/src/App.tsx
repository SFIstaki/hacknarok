import { useState } from 'react';
import Login from './components/Login';
import { translations } from './i18n';
import Layout from './components/Layout';
import PreferencesForm from './pages/Preferences';
import type { Lang } from './i18n';

export type Theme = 'light' | 'dark';

function App(): React.JSX.Element {
  const [username, setUsername] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('light');
  const [lang, setLang] = useState<Lang>('en');
  const [showPreferences, setShowPreferences] = useState<boolean>(false);

  const themeToggle = (): void => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  const langToggle = (): void => setLang((l) => (l === 'en' ? 'pl' : 'en'));

  if (!username) {
    return (
      <Login
        onLogin={(name) => setUsername(name)}
        onRegister={(name) => {
          setUsername(name);
          setShowPreferences(true);
        }}
        theme={theme}
        onThemeToggle={themeToggle}
        lang={lang}
        onLangToggle={langToggle}
        t={translations[lang]}
      />
    );
  }

  if (showPreferences) {
    return (
      <PreferencesForm
        username={username}
        onSubmit={() => setShowPreferences(false)}
        t={translations[lang]}
        theme={theme}
        onThemeToggle={themeToggle}
        lang={lang}
        onLangToggle={langToggle}
      />
    );
  }

  return (
    <Layout
      username={username}
      onLogout={() => setUsername(null)}
      theme={theme}
      onThemeToggle={themeToggle}
      lang={lang}
      onLangToggle={langToggle}
    />
  );
}

export default App;
