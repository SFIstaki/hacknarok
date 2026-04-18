import type { T } from '../i18n';
import '../assets/main.css';
import '../assets/settings.css';
import React from 'react';

interface SettingsProps {
  t: T;
}

export default function Settings({ t }: SettingsProps): React.JSX.Element {
  const [mode, setMode] = React.useState<'relaks' | 'focus'>('focus');
  const [showModeInfo, setShowModeInfo] = React.useState(false);
  return (
    <div className="page-content settings-page">
      <div className="settings-container">
        <h2 className="settings-title">{t.navSettings}</h2>

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
              className={`settings-mode-btn${mode === 'relaks' ? ' active' : ''}`}
              onClick={() => setMode('relaks')}
              title={t.settingsModeRelaksDesc}
            >
              {t.settingsModeRelaks}
            </button>
            <button
              className={`settings-mode-btn${mode === 'focus' ? ' active' : ''}`}
              onClick={() => setMode('focus')}
              title={t.settingsModeFocusDesc}
            >
              {t.settingsModeFocus}
            </button>
          </div>
        </div>

        {showModeInfo && (
          <div className="settings-modal-bg" onClick={() => setShowModeInfo(false)}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
              <div className="settings-modal-title">{t.settingsModesTitle}</div>
              <div className="settings-modal-desc">
                <span className="settings-modal-label">{t.settingsModeRelaks}:</span>{' '}
                {t.settingsModeRelaksDesc}
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

        <div className="settings-section">
          <div className="settings-label">{t.settingsUnconfuseTime}</div>
          <input
            type="number"
            min={1}
            max={30}
            defaultValue={5}
            className="settings-input settings-input-number"
            disabled
          />
          <span className="settings-unconfuse-time-unit">{t.settingsUnconfuseTimeUnit}</span>
        </div>
      </div>
      <div className="settings-consent">{t.dataProcessingConsent}</div>
    </div>
  );
}
