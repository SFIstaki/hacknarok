import React from 'react';
import type { T, FocusState } from '../i18n';
import type { Theme } from '../App';

interface AboutProps {
  t: T;
  theme: Theme;
}

const STATE_COLOR: Record<FocusState, string> = {
  locked: '#48bb78',
  fading: '#ed8936',
  gone: '#e53e3e',
};

export default function About({ t, theme }: AboutProps): React.JSX.Element {
  return (
    <div className={`about-page page-content${theme === 'dark' ? ' dark' : ''}`}>
      <div className="about-content-col">
        <h2 className="about-title">{t.aboutTitle}</h2>
        <p className="about-tagline">{t.aboutTagline}</p>

        <section className="about-section">
          <h3 className="about-section-title">{t.aboutWhat}</h3>
          <p className="about-body">{t.aboutWhatBody}</p>
        </section>

        <section className="about-section">
          <h3 className="about-section-title">{t.aboutHow}</h3>
          <ul className="about-list">
            {(t.aboutHowItems as string[]).map((item, i) => (
              <li key={i} className="about-list-item">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="about-section">
          <h3 className="about-section-title">{t.aboutStates}</h3>
          <div className="about-states">
            <div className="about-state-row">
              <span className="about-state-dot" style={{ background: STATE_COLOR.locked }} />
              <span className="about-body">{t.aboutStateLocked}</span>
            </div>
            <div className="about-state-row">
              <span className="about-state-dot" style={{ background: STATE_COLOR.fading }} />
              <span className="about-body">{t.aboutStateFading}</span>
            </div>
            <div className="about-state-row">
              <span className="about-state-dot" style={{ background: STATE_COLOR.gone }} />
              <span className="about-body">{t.aboutStateGone}</span>
            </div>
          </div>
          <p className="about-camera-pointer">{t.aboutCameraPointer}</p>
        </section>

        <section className="about-section">
          <h3 className="about-section-title">{t.aboutPrivacy}</h3>
          <p className="about-body">{t.aboutPrivacyBody}</p>
        </section>
      </div>
    </div>
  );
}
