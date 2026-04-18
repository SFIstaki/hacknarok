import React, { useState } from 'react';
import '../assets/main.css';
import '../assets/preferences.css';

import type { T } from '../i18n';

interface PreferencesFormProps {
  onSubmit?: () => void;
  t?: T;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
  lang?: 'en' | 'pl';
  onLangToggle?: () => void;
}

// Reusable Language Toggle
const LangToggle = ({ lang, onLangToggle }: { lang: 'en' | 'pl'; onLangToggle?: () => void }) => (
  <button type="button" className="lang-toggle" onClick={onLangToggle}>
    <span className={lang === 'en' ? 'lang-active' : ''}>EN</span>
    <span className="lang-sep">/</span>
    <span className={lang === 'pl' ? 'lang-active' : ''}>PL</span>
  </button>
);

// Reusable Theme Toggle
const ThemeToggle = ({
  theme,
  onThemeToggle,
}: {
  theme: 'light' | 'dark';
  onThemeToggle?: () => void;
}) => (
  <button
    type="button"
    className="theme-toggle"
    onClick={onThemeToggle}
    title={theme === 'light' ? 'Dark mode' : 'Light mode'}
  >
    {theme === 'light' ? (
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
    ) : (
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
    )}
  </button>
);

export default function PreferencesForm({
  onSubmit,
  t,
  theme = 'light',
  onThemeToggle,
  lang = 'en',
  onLangToggle,
}: PreferencesFormProps) {
  const tt = t || ({} as T);
  const [selectedUserType, setSelectedUserType] = useState<string | null>(null);
  const [selectedUsageTypes, setSelectedUsageTypes] = useState<string[]>([]);
  const [alertSensitivity, setAlertSensitivity] = useState<number>(30);
  const [errors, setErrors] = useState<{ userType?: string; usageTypes?: string }>({});

  const userTypes = tt.preferencesUserTypes || ['Student', 'Professional', 'Freelancer', 'Other'];
  const usageTypes = tt.preferencesUsageTypes || [
    'Working',
    'Studying',
    'Relax',
    'Watch a movie',
    'Research',
    'Writing',
    'Other',
  ];
  const alertSensitivities = tt.preferencesAlertSensitivities || [
    { label: 'Low', value: 60 },
    { label: 'Medium', value: 30 },
    { label: 'High', value: 10 },
  ];

  const toggleSelection = (arr: string[], value: string, setter: (v: string[]) => void) => {
    setter(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const handleUserTypeSelect = (type: string) => {
    setSelectedUserType(type);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { userType?: string; usageTypes?: string } = {};
    if (!selectedUserType)
      newErrors.userType = tt.preferencesUserTypeError || 'Please select a user type';
    if (selectedUsageTypes.length === 0)
      newErrors.usageTypes =
        tt.preferencesUsageTypeError || 'Please select at least one usage type';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    // Determine app mode based on usageTypes
    const usageLower = selectedUsageTypes.map((u) => u.toLowerCase());
    let mode: 'relax' | 'focus' | undefined = undefined;
    if (
      (usageLower.includes('relax') || usageLower.includes('watch a movie')) &&
      !usageLower.includes('working') &&
      !usageLower.includes('studying')
    ) {
      mode = 'relax';
    } else if (usageLower.includes('working') || usageLower.includes('studying')) {
      mode = 'focus';
    }
    // Fallback: always set a mode
    if (!mode) mode = 'focus';
    const preferences = {
      userType: selectedUserType,
      usageTypes: selectedUsageTypes,
      alertSensitivity,
      mode,
    };
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
    if (onSubmit) onSubmit();
  };

  return (
    <div className={`preferences-page${theme === 'dark' ? ' dark' : ''}`}>
      <form className={`preferences-form ${theme}`} onSubmit={handleSubmit}>
        <div className="preferences-header-controls">
          {onLangToggle && <LangToggle lang={lang} onLangToggle={onLangToggle} />}
          {onThemeToggle && <ThemeToggle theme={theme} onThemeToggle={onThemeToggle} />}
        </div>
        <h2 className="preferences-title">{tt.preferencesTitle || 'Tell us about yourself'}</h2>
        <div className="preferences-section">
          <div className="preferences-label">{tt.preferencesUserType || 'Are you a...?'} </div>
          <div className="preferences-pills">
            {userTypes.map((type) => (
              <button
                type="button"
                key={type}
                className={selectedUserType === type ? 'pill selected' : 'pill'}
                onClick={() => handleUserTypeSelect(type)}
              >
                {type}
              </button>
            ))}
          </div>
          {errors.userType && <div className="preferences-error">{errors.userType}</div>}
        </div>
        <div className="preferences-section">
          <div className="preferences-label">
            {tt.preferencesUsageType || 'How do you plan on using the app?'}
          </div>
          <div className="preferences-pills">
            {usageTypes.map((type) => (
              <button
                type="button"
                key={type}
                className={selectedUsageTypes.includes(type) ? 'pill selected' : 'pill'}
                onClick={() => toggleSelection(selectedUsageTypes, type, setSelectedUsageTypes)}
              >
                {type}
              </button>
            ))}
          </div>
          {errors.usageTypes && <div className="preferences-error">{errors.usageTypes}</div>}
        </div>
        <div className="preferences-section">
          <div className="preferences-label">
            {tt.preferencesAlertSensitivity || 'Alert sensitivity'}
          </div>
          <div className="preferences-pills">
            {alertSensitivities.map((opt) => (
              <button
                type="button"
                key={opt.value}
                className={alertSensitivity === opt.value ? 'pill selected' : 'pill'}
                onClick={() => setAlertSensitivity(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <button className="preferences-submit" type="submit">
          {tt.preferencesSave || 'Save Preferences'}
        </button>
      </form>
    </div>
  );
}
