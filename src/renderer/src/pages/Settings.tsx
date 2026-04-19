import type { T } from '../i18n';
import '../assets/main.css';
import '../assets/settings.css';
import '../assets/preferences.css';
import React, { useState, useEffect, useRef } from 'react';

interface SettingsProps {
  t: T;
}

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem('userPreferences') || '{}');
  } catch {
    return {};
  }
}

function savePrefs(patch: object) {
  const current = loadPrefs();
  localStorage.setItem('userPreferences', JSON.stringify({ ...current, ...patch }));
}

export default function Settings({ t }: SettingsProps): React.JSX.Element {
  const saved = loadPrefs();
  const [mode, setMode] = useState<'relax' | 'focus'>(saved.mode || 'focus');
  const [showModeInfo, setShowModeInfo] = useState(false);
  const [userType, setUserType] = useState<string>(saved.userType ?? '');
  const [usageTypes, setUsageTypes] = useState<string[]>(saved.usageTypes ?? []);
  const [alertSensitivity, setAlertSensitivity] = useState<number>(saved.alertSensitivity ?? 30);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = () => {
    setSavedFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedFlash(false), 1800);
  };

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );

  const setAndSaveUserType = (v: string) => {
    setUserType(v);
    savePrefs({ userType: v });
    flash();
  };

  const toggleUsageType = (v: string) => {
    setUsageTypes((prev) => {
      const next = prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v];
      savePrefs({ usageTypes: next });
      flash();
      return next;
    });
  };

  const setAndSaveAlertSensitivity = (v: number) => {
    setAlertSensitivity(v);
    savePrefs({ alertSensitivity: v });
    flash();
  };

  const userTypes = t.preferencesUserTypes as readonly string[];
  const usageTypeOptions = t.preferencesUsageTypes as readonly string[];
  const alertOptions = t.preferencesAlertSensitivities as readonly {
    label: string;
    value: number;
  }[];

  const handleSetMode = (newMode: 'relax' | 'focus') => {
    setMode(newMode);
    savePrefs({ mode: newMode });
    flash();
  };

  return (
    <div className="page-content settings-page">
      <div className="settings-container">
        <div className="settings-title-row">
          <h2 className="settings-title">{t.navSettings}</h2>
          {savedFlash && (
            <span className="settings-saved-flash settings-saved-flash-green">
              {t.settingsSaved}
            </span>
          )}
        </div>
        <div className="settings-section">
          <div className="settings-label settings-label-flex">
            {t.settingsAppMode}
            <span
              className="settings-help-circle"
              tabIndex={0}
              title={t.settingsAppModeHelp}
              onClick={() => setShowModeInfo(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setShowModeInfo(true);
              }}
              aria-label={t.settingsAppModeHelpAria}
            >
              ?
            </span>
          </div>
          <div className="settings-modes">
            <button
              className={`settings-mode-btn${mode === 'relax' ? ' active' : ''}`}
              onClick={() => handleSetMode('relax')}
              title={t.settingsModeRelaxDesc}
            >
              {t.settingsModeRelax}
            </button>
            <button
              className={`settings-mode-btn${mode === 'focus' ? ' active' : ''}`}
              onClick={() => handleSetMode('focus')}
              title={t.settingsModeFocusDesc}
            >
              {t.settingsModeFocus}
            </button>
          </div>
        </div>
        <div className="settings-section">
          <div className="settings-sub-label">{t.preferencesUserType}</div>
          <div className="preferences-pills settings-pills">
            {userTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={userType === type ? 'pill selected' : 'pill'}
                onClick={() => setAndSaveUserType(type)}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="settings-sub-label" style={{ marginTop: 16 }}>
            {t.preferencesUsageType}
          </div>
          <div className="preferences-pills settings-pills">
            {usageTypeOptions.map((type) => (
              <button
                key={type}
                type="button"
                className={usageTypes.includes(type) ? 'pill selected' : 'pill'}
                onClick={() => toggleUsageType(type)}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="settings-sub-label" style={{ marginTop: 16 }}>
            {t.preferencesAlertSensitivity}
          </div>
          <div className="preferences-pills settings-pills">
            {alertOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={alertSensitivity === opt.value ? 'pill selected' : 'pill'}
                onClick={() => setAndSaveAlertSensitivity(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {showModeInfo && (
        <div className="settings-modal-bg" onClick={() => setShowModeInfo(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-title">{t.settingsModesTitle}</div>
            <div className="settings-modal-desc">
              <span className="settings-modal-label">{t.settingsModeRelax}:</span>{' '}
              {t.settingsModeRelaxDesc}
            </div>
            <div className="settings-modal-desc">
              <span className="settings-modal-label">{t.settingsModeFocus}:</span>{' '}
              {t.settingsModeFocusDesc}
            </div>
            <button className="settings-modal-close-btn" onClick={() => setShowModeInfo(false)}>
              {t.settingsClose}
            </button>
          </div>
        </div>
      )}
      <div className="settings-consent">{t.dataProcessingConsent}</div>
    </div>
  );
}
