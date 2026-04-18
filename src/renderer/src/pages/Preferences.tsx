import React, { useState } from 'react';
import '../assets/main.css';
import '../assets/preferences.css';

import type { T } from '../i18n';

interface PreferencesFormProps {
  username: string;
  onSubmit?: () => void;
  t?: T;
  theme?: 'light' | 'dark';
  onThemeToggle?: () => void;
  lang?: 'en' | 'pl';
  onLangToggle?: () => void;
}

interface PreferencesPayload {
  username: string;
  userType: string;
  usageTypes: string[];
  alertSensitivity: number;
}

async function uploadPreferencesToSupabase(payload: PreferencesPayload): Promise<void> {
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const bucketName = 'settings';

  if (!supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_ANON_KEY');
  }

  const safeUsername = payload.username.trim().replace(/[^a-zA-Z0-9._-]/g, '_') || 'preferences';
  const fileName = `${safeUsername}.json`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${encodeURIComponent(fileName)}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    },
    body: JSON.stringify(payload, null, 2),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase upload failed (${response.status}): ${errorText}`);
  }
}

async function savePreferences(payload: PreferencesPayload): Promise<void> {
  await uploadPreferencesToSupabase(payload);
}

// Reusable Language Toggle
const LangToggle = ({
  lang,
  onLangToggle,
}: {
  lang: 'en' | 'pl';
  onLangToggle?: () => void;
}): React.JSX.Element => (
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
}): React.JSX.Element => (
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
  username,
  onSubmit,
  t,
  theme = 'light',
  onThemeToggle,
  lang = 'en',
  onLangToggle,
}: PreferencesFormProps): React.JSX.Element {
  const tt = t || ({} as T);
  const [selectedUserType, setSelectedUserType] = useState<string | null>(null);
  const [selectedUsageTypes, setSelectedUsageTypes] = useState<string[]>([]);
  const [alertSensitivity, setAlertSensitivity] = useState<number>(30);
  const [errors, setErrors] = useState<{
    username?: string;
    userType?: string;
    usageTypes?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const userTypes = tt.preferencesUserTypes || ['Student', 'Professional', 'Freelancer', 'Other'];
  const usageTypes = tt.preferencesUsageTypes || [
    'Working',
    'Studying',
    'Relax',
    'Research',
    'Writing',
    'Other',
  ];
  const alertSensitivities = tt.preferencesAlertSensitivities || [
    { label: 'Low', value: 60 },
    { label: 'Medium', value: 30 },
    { label: 'High', value: 10 },
  ];

  const toggleSelection = (arr: string[], value: string, setter: (v: string[]) => void): void => {
    setter(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const handleUserTypeSelect = (type: string): void => {
    setSelectedUserType(type);
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const newErrors: { username?: string; userType?: string; usageTypes?: string } = {};
    if (!username || username.trim().length === 0) {
      newErrors.username = 'Username is required';
    }
    if (!selectedUserType) newErrors.userType = 'Please select a user type';
    if (!Array.isArray(selectedUsageTypes) || selectedUsageTypes.length === 0)
      newErrors.usageTypes = 'Please select at least one usage type';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setSubmitError('');
    const preferences: PreferencesPayload = {
      username,
      userType: selectedUserType as string,
      usageTypes: selectedUsageTypes,
      alertSensitivity,
    };

    try {
      setIsSaving(true);
      await savePreferences(preferences);
      if (onSubmit) onSubmit();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setSubmitError(`Failed to upload preferences: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`preferences-page${theme === 'dark' ? ' dark' : ''}`}>
      <form className={`preferences-form ${theme}`} onSubmit={handleSubmit}>
        <div className="preferences-header-controls">
          {onLangToggle && <LangToggle lang={lang} onLangToggle={onLangToggle} />}
          {onThemeToggle && <ThemeToggle theme={theme} onThemeToggle={onThemeToggle} />}
        </div>
        <h2 className="preferences-title">{tt.preferencesTitle || 'Tell us about yourself'}</h2>
        {errors.username && <div className="preferences-error">{errors.username}</div>}
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
        {submitError && <div className="preferences-error">{submitError}</div>}
        <button className="preferences-submit" type="submit" disabled={isSaving}>
          {tt.preferencesSave || 'Save Preferences'}
        </button>
      </form>
    </div>
  );
}
