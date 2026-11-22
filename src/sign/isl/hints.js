// Plain-language advice for an ISL letter that isn't recognised yet: the hands first, then the
// letter's own measurement that is furthest outside its usual range.
import { ISL_LETTERS } from './letters.js';

/**
 * @param {string} letter
 * @param {object} f measurements from measurePair (with eyeDist when a face was seen)
 * @param {object} ranges ISL_DATA.ranges
 * @returns {string} advice, or '' when nothing stands out
 */
export function islHint(letter, f, ranges) {
  const def = ISL_LETTERS[letter];
  if (!def || !f) return '';
  if (def.hands === 2 && f.nHands < 2) return 'Only one hand is in view. This letter uses both, so keep both hands inside the picture';
  if (def.hands === 1 && f.nHands > 1) return 'This letter uses one hand. Lower the other one';
  if (def.face && Number.isFinite(f.eyeDist) && f.eyeDist > 1.2) return 'Bring your fingertip to your cheek, just under your eye';
  let worst = '', worstBy = 0;
  for (const [key, dir, advice] of def.hints) {
    const r = ranges[letter] && ranges[letter][key];
    const v = f[key];
    if (!r || !Number.isFinite(v)) continue;
    const span = Math.max(0.05, r[1] - r[0]);
    const by = dir === 'hi' ? (v - r[1]) / span : (r[0] - v) / span;
    if (by > worstBy) { worstBy = by; worst = advice; }
  }
  return worst;
}
