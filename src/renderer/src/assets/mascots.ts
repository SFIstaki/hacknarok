import type { Behavior } from '../hooks/useFocusTracking';

const B = '#8B5E3C';
const M = '#D4A574';
const D = '#2D1000';

const mk = (eyes: string, mouth: string, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="52" height="52">` +
  `<ellipse cx="10" cy="12" rx="6" ry="7" fill="${B}"/>` +
  `<ellipse cx="10" cy="12" rx="4" ry="5" fill="${M}"/>` +
  `<ellipse cx="38" cy="12" rx="6" ry="7" fill="${B}"/>` +
  `<ellipse cx="38" cy="12" rx="4" ry="5" fill="${M}"/>` +
  `<ellipse cx="24" cy="24" rx="18" ry="17" fill="${B}"/>` +
  `<ellipse cx="24" cy="31" rx="12" ry="9" fill="${M}"/>` +
  `<ellipse cx="24" cy="27" rx="2.5" ry="2" fill="#3D1A00"/>` +
  eyes +
  mouth +
  extra +
  `</svg>`;

const eOpen =
  `<circle cx="17" cy="19" r="3.5" fill="${D}"/><circle cx="31" cy="19" r="3.5" fill="${D}"/>` +
  `<circle cx="18.5" cy="18" r="1.2" fill="white"/><circle cx="32.5" cy="18" r="1.2" fill="white"/>`;
const eClosed =
  `<path d="M14 20 Q17 16.5 20 20" stroke="${D}" stroke-width="2.5" fill="none" stroke-linecap="round"/>` +
  `<path d="M28 20 Q31 16.5 34 20" stroke="${D}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
const eHalf =
  `<ellipse cx="17" cy="20" rx="3.5" ry="2" fill="${D}"/><ellipse cx="31" cy="20" rx="3.5" ry="2" fill="${D}"/>` +
  `<ellipse cx="18.5" cy="20" rx="1" ry="0.7" fill="white"/><ellipse cx="32.5" cy="20" rx="1" ry="0.7" fill="white"/>`;
const eWide =
  `<circle cx="17" cy="19" r="4.5" fill="${D}"/><circle cx="31" cy="19" r="4.5" fill="${D}"/>` +
  `<circle cx="19" cy="17.5" r="1.5" fill="white"/><circle cx="33" cy="17.5" r="1.5" fill="white"/>`;
const eRight =
  `<circle cx="17" cy="19" r="3.5" fill="${D}"/><circle cx="31" cy="19" r="3.5" fill="${D}"/>` +
  `<circle cx="20" cy="18" r="1.2" fill="white"/><circle cx="34" cy="18" r="1.2" fill="white"/>`;
const eLeft =
  `<circle cx="17" cy="19" r="3.5" fill="${D}"/><circle cx="31" cy="19" r="3.5" fill="${D}"/>` +
  `<circle cx="15" cy="18" r="1.2" fill="white"/><circle cx="29" cy="18" r="1.2" fill="white"/>`;

const mSmile =
  `<path d="M17 29 Q24 34 31 29" stroke="${D}" stroke-width="1.5" fill="none" stroke-linecap="round"/>` +
  `<rect x="20" y="29" width="8" height="4.5" rx="1.5" fill="white"/>` +
  `<line x1="24" y1="29" x2="24" y2="33.5" stroke="#E0D0C0" stroke-width="1"/>`;
const mYawn =
  `<ellipse cx="24" cy="32" rx="6" ry="5.5" fill="${D}"/>` +
  `<ellipse cx="24" cy="31" rx="4.5" ry="3.5" fill="#CC4444"/>` +
  `<rect x="21" y="28" width="6" height="2" rx="0.5" fill="white"/>`;
const mFlat =
  `<path d="M18 30 L30 30" stroke="${D}" stroke-width="1.5" stroke-linecap="round"/>` +
  `<rect x="20" y="30" width="8" height="4" rx="1.5" fill="white"/>` +
  `<line x1="24" y1="30" x2="24" y2="34" stroke="#E0D0C0" stroke-width="1"/>`;
const mWorry =
  `<path d="M17 31 Q24 27.5 31 31" stroke="${D}" stroke-width="1.5" fill="none" stroke-linecap="round"/>` +
  `<rect x="20" y="27.5" width="8" height="4" rx="1.5" fill="white"/>` +
  `<line x1="24" y1="27.5" x2="24" y2="31.5" stroke="#E0D0C0" stroke-width="1"/>`;

const xZzz = `<text x="30" y="9" font-size="9" fill="#B8A8CC" font-family="Arial" font-weight="bold" opacity="0.9">zzz</text>`;
const xSearch =
  `<circle cx="36" cy="11" r="5" fill="none" stroke="${B}" stroke-width="2.5"/>` +
  `<line x1="39.5" y1="14.5" x2="43" y2="18" stroke="${B}" stroke-width="2.5" stroke-linecap="round"/>`;
const xSweat = `<ellipse cx="37" cy="15" rx="2" ry="3" fill="#7EC8F5" opacity="0.9"/>`;
const xPhone =
  `<rect x="32" y="26" width="9" height="14" rx="2" fill="#1A1A2E"/>` +
  `<rect x="33" y="28" width="7" height="9" fill="#4A9EFF" rx="0.5"/>` +
  `<circle cx="36.5" cy="38.5" r="1" fill="#555"/>`;
const xStar = `<text x="32" y="10" font-size="10" fill="#FFD700" opacity="0.9">✦</text>`;
const xWave = `<path d="M3 40 Q7 36 11 40 Q15 44 19 40" stroke="${B}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;

export const MASCOT_VARIANTS: Record<string, string[]> = {
  faceAbsent: [mk(eWide, mFlat, xSearch), mk(eRight, mWorry, xSweat), mk(eWide, mWorry)],
  eyesClosed: [mk(eClosed, mFlat, xZzz), mk(eHalf, mFlat, xZzz), mk(eClosed, mSmile, xZzz)],
  yawning: [mk(eHalf, mYawn), mk(eClosed, mYawn), mk(eHalf, mYawn, xStar)],
  lookingAway: [mk(eRight, mFlat), mk(eLeft, mFlat), mk(eRight, mWorry, xSweat)],
  headTurned: [mk(eLeft, mWorry), mk(eRight, mFlat, xPhone), mk(eLeft, mFlat, xSweat)],
  test: [mk(eOpen, mSmile, xWave), mk(eWide, mSmile), mk(eOpen, mSmile, xStar)],
};

export function pickMascot(behavior: Behavior | 'test'): string {
  const variants = MASCOT_VARIANTS[behavior] ?? MASCOT_VARIANTS.test;
  return variants[Math.floor(Math.random() * variants.length)];
}
