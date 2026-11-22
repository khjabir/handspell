// Measurements for the two-handed ISL alphabet. Most ISL letters are defined by contact
// between the hands: which fingertip touches which, fingers crossing, fingers laid on the
// other palm, fists stacked. Those relations are the same for everyone, so they are measured
// directly, alongside the shape of each hand (from the one-hand measurements in ../features.js).
//
// The two hands are called "a" (the one on the right of the picture) and "b" (the other).
// Distances are in palm lengths.
import { toPoints, measure } from '../features.js';

const TIPS = [4, 8, 12, 16, 20];
const NAMES = { 0: 'wrist', 4: 'thumb', 8: 'index', 12: 'middle', 16: 'ring', 20: 'pinky' };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mean = (P, idx) => [0, 1, 2].map((k) => idx.reduce((s, i) => s + P[i][k], 0) / idx.length);
const PALM = [0, 5, 9, 13, 17];

/** Do segments p1-p2 and q1-q2 cross (in the picture)? */
function crosses(p1, p2, q1, q2) {
  const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  return o(p1, p2, q1) !== o(p1, p2, q2) && o(q1, q2, p1) !== o(q1, q2, p2);
}

/** Is point p inside polygon poly (in the picture)? */
function inside(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Shape measurements for one hand, prefixed (a = active, b = base). */
const SHAPE = ['indexCurl', 'middleCurl', 'ringCurl', 'pinkyCurl', 'indexExt', 'middleExt', 'thumbExt', 'thumbIndexTip', 'tipsToThumb', 'spreadIM'];

/**
 * Which hand is which. In the photo collections Handspell learned from, the hands keep to their
 * sides, so with two hands, "a" is the one whose wrist is further right in the picture and "b"
 * the other. (MediaPipe's left/right labels are not used for this: they flip when the back of the
 * hand faces the camera.) live.js tries the picture both ways round, so either hand can lead.
 * @param {Array} hands [{ lm }]
 * @returns {{a: number, b: number}} indices into hands (b is -1 with one hand)
 */
export function pickHands(hands) {
  if (hands.length < 2) return { a: 0, b: -1 };
  return hands[0].lm[0].x >= hands[1].lm[0].x ? { a: 0, b: 1 } : { a: 1, b: 0 };
}

/**
 * @param {Array} hands [{ lm: 21 points (0..1 picture coords), label: 'Left'|'Right' }] as MediaPipe
 *   gives them
 * @param {object} o { aspect: picture width / height }
 * @returns measurements, or null when no hand is visible
 */
export function measurePair(hands, { aspect = 1 } = {}) {
  if (!hands.length) return null;
  const pick = pickHands(hands);
  const A = hands[pick.a];
  const B = pick.b >= 0 ? hands[pick.b] : null;
  const f = { nHands: B ? 2 : 1 };
  const PA = toPoints(A.lm, { aspect });
  // measure() expects a right hand. With one hand, MediaPipe's label says which it is
  // (reliable when the palm or the side faces the camera, as in the one-hand letters).
  const ma = !B && A.label === 'Right' ? measure(toPoints(A.lm, { aspect, mirror: true })) : measure(PA);
  for (const k of SHAPE) f[`a_${k}`] = ma[k];
  f.a_handTilt = ma.handTilt;
  f.a_indexTilt = ma.indexTilt;
  f.aPalm = ma.palm;
  if (!B) return f;

  const PB = toPoints(B.lm, { aspect });
  // The base hand is mirrored into a right hand for its shape measurements
  const mb = measure(toPoints(B.lm, { aspect, mirror: true }));
  for (const k of SHAPE) f[`b_${k}`] = mb[k];
  f.b_handTilt = mb.handTilt;
  f.b_indexTilt = mb.indexTilt;

  const palm = (ma.palm + mb.palm) / 2 || 1e-6;
  const dist = (p, q) => d2(p, q) / palm;
  // Fingertip to fingertip, active to base
  for (const i of TIPS) for (const j of TIPS) f[`t_${NAMES[i]}_${NAMES[j]}`] = dist(PA[i], PB[j]);
  // Fingertips to the other hand's palm centre, and palm to palm
  const ca = mean(PA, PALM), cb = mean(PB, PALM);
  for (const i of TIPS) f[`a_${NAMES[i]}_bPalm`] = dist(PA[i], cb);
  for (const j of [8, 20]) f[`b_${NAMES[j]}_aPalm`] = dist(PB[j], ca);
  f.palms = dist(ca, cb);
  f.wrists = dist(PA[0], PB[0]);
  // Active index tip against the base index finger's joints, and the base index tip against the active index (T, D, K, P)
  f.aIndex_bIndexMid = dist(PA[8], PB[6]);
  f.aIndex_bIndexBase = dist(PA[8], PB[5]);
  f.aThumb_bIndexBase = dist(PA[4], PB[5]);
  f.bIndex_aIndexMid = Math.min(dist(PB[8], PA[6]), dist(PB[8], PA[7]));
  // Crossing index fingers (X), and index plus middle (F)
  f.crossIndex = crosses(PA[5], PA[8], PB[5], PB[8]) ? 1 : 0;
  f.crossTwo = crosses(PA[5], PA[8], PB[5], PB[8]) || crosses(PA[9], PA[12], PB[9], PB[12]) || crosses(PA[5], PA[8], PB[9], PB[12]) || crosses(PA[9], PA[12], PB[5], PB[8]) ? 1 : 0;
  // How many active fingertips lie on the base hand's palm (M, N, R, H, V-on-palm)
  const bPoly = [0, 1, 2, 5, 9, 13, 17].map((i) => PB[i]);
  f.tipsOnPalm = [8, 12, 16, 20].filter((i) => inside(PA[i], bPoly)).length;
  const aPoly = [0, 1, 2, 5, 9, 13, 17].map((i) => PA[i]);
  f.baseTipsOnPalm = [8, 12, 16, 20].filter((i) => inside(PB[i], aPoly)).length;
  // Fists one above the other (G): vertical offset of the palm centres, in palm lengths
  f.stackY = (ca[1] - cb[1]) / palm;
  f.stackX = (ca[0] - cb[0]) / palm;
  // Angle between the two index fingers (X, T, E)
  const ua = sub(PA[8], PA[5]), ub = sub(PB[8], PB[5]);
  f.indexAngle = Math.acos(Math.max(-1, Math.min(1, (ua[0] * ub[0] + ua[1] * ub[1]) / ((Math.hypot(ua[0], ua[1]) * Math.hypot(ub[0], ub[1])) || 1e-6)))) * 180 / Math.PI;
  // Closest fingertip contact overall
  let best = Infinity;
  for (const i of TIPS) for (const j of TIPS) best = Math.min(best, f[`t_${NAMES[i]}_${NAMES[j]}`]);
  f.closestTips = best;
  return f;
}

/** Every measurement name measurePair can produce (for templates and matching). */
export const PAIR_KEYS = (() => {
  const k = ['nHands', ...SHAPE.map((s) => `a_${s}`), 'a_handTilt', 'a_indexTilt', ...SHAPE.map((s) => `b_${s}`), 'b_handTilt', 'b_indexTilt'];
  for (const i of TIPS) for (const j of TIPS) k.push(`t_${NAMES[i]}_${NAMES[j]}`);
  for (const i of TIPS) k.push(`a_${NAMES[i]}_bPalm`);
  k.push('b_index_aPalm', 'b_pinky_aPalm', 'palms', 'wrists', 'aIndex_bIndexMid', 'aIndex_bIndexBase', 'aThumb_bIndexBase', 'bIndex_aIndexMid',
    'crossIndex', 'crossTwo', 'tipsOnPalm', 'baseTipsOnPalm', 'stackY', 'stackX', 'indexAngle', 'closestTips');
  return k;
})();
