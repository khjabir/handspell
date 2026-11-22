// Turns 21 MediaPipe hand landmarks into a handful of numbers that describe a handshape:
// how bent each finger is, where the thumb sits, which fingertips touch, how far the
// fingers spread, and which way the hand points. Everything is measured in the hand's own
// frame and scaled by the palm, so position, distance from the camera and left or right
// hand don't matter.
//
// Landmark numbering (MediaPipe): 0 wrist; thumb 1-4; index 5-8; middle 9-12; ring 13-16;
// pinky 17-20. For each finger the joints are MCP (knuckle), PIP, DIP, then the tip.

export const FINGERS = ['index', 'middle', 'ring', 'pinky'];
const BASE = { index: 5, middle: 9, ring: 13, pinky: 17 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const DEG = 180 / Math.PI;
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) * DEG;

/**
 * Normalise raw landmarks to a right hand in a common pixel aspect.
 * @param {Array<{x:number,y:number,z:number}>|number[][]} lm 21 landmarks, x and y in 0..1 of the image
 * @param {object} o
 * @param {number} o.aspect image width / height (1 if the landmarks are already in a square frame)
 * @param {boolean} o.mirror true for a left hand (mirrors it into a right hand)
 * @returns {number[][]} 21 points [x, y, z], y pointing down as in the image
 */
export function toPoints(lm, { aspect = 1, mirror = false } = {}) {
  return lm.map((p) => {
    const x = Array.isArray(p) ? p[0] : p.x, y = Array.isArray(p) ? p[1] : p.y, z = Array.isArray(p) ? p[2] : p.z;
    const X = x * aspect, Z = (z || 0) * aspect;
    return [mirror ? -X : X, y, Z];
  });
}

/**
 * Measure a handshape.
 * @param {number[][]} P 21 points from toPoints()
 */
export function measure(P) {
  const wrist = P[0];
  const palm = len(sub(P[9], P[0])) || 1e-6;
  // Hand frame: up runs from the wrist to the middle knuckle, across from the pinky knuckle to
  // the index knuckle, and the normal comes out of the palm (the side the fingers curl towards).
  const up = norm(sub(P[9], P[0]));
  const across0 = sub(P[5], P[17]);
  let normal = norm(cross(across0, up));
  // MediaPipe sometimes mistakes a left hand for a right one (it happens most with the hand
  // side-on), which would put the palm on the wrong side. Fingers only curl towards the
  // palm, so when they are bent, the way they bend tells us where the palm really is.
  let curlSide = 0, curlWeight = 0;
  for (const name of FINGERS) {
    const b = BASE[name];
    const bend = angle(sub(P[b + 1], P[b]), sub(P[b + 3], P[b + 1])); // knuckle line vs tip line
    const w = Math.max(0, Math.min(1, (bend - 25) / 60));
    curlSide += w * dot(norm(sub(P[b + 3], P[b])), normal);
    curlWeight += w;
  }
  const flipped = curlWeight > 0.8 && curlSide / curlWeight < -0.12;
  if (flipped) normal = mul(normal, -1);
  const across = norm(cross(up, normal));
  const local = (p) => { const d = sub(p, wrist); return [dot(d, across) / palm, dot(d, up) / palm, dot(d, normal) / palm]; };
  const L = P.map(local);
  const dist = (i, j) => len(sub(P[i], P[j])) / palm;

  const f = { palm };
  // Fingers
  for (const name of FINGERS) {
    const b = BASE[name];
    const mcp = P[b], pip = P[b + 1], dip = P[b + 2], tip = P[b + 3];
    const aMcp = angle(sub(mcp, wrist), sub(pip, mcp));
    const aPip = angle(sub(pip, mcp), sub(dip, pip));
    const aDip = angle(sub(dip, pip), sub(tip, dip));
    const chain = len(sub(pip, mcp)) + len(sub(dip, pip)) + len(sub(tip, dip));
    f[`${name}Mcp`] = aMcp;
    f[`${name}Pip`] = aPip;
    f[`${name}Dip`] = aDip;
    f[`${name}Curl`] = aMcp + aPip + aDip;
    f[`${name}Ext`] = len(sub(tip, mcp)) / (chain || 1e-6); // 1 = straight
    f[`${name}TipUp`] = L[b + 3][1]; // how far the tip reaches up the hand (palm lengths)
    f[`${name}TipAcross`] = L[b + 3][0];
    f[`${name}TipOut`] = L[b + 3][2]; // + in front of the palm, - behind the hand
    // Direction the finger points (knuckle to tip) in the image, in degrees: 0 = up,
    // 90 = sideways towards the thumb side of a right hand facing the camera, 180 = down.
    const d = sub(tip, mcp);
    f[`${name}Dir`] = Math.atan2(d[0], -d[1]) * DEG;
  }

  // Thumb
  const t = L[4];
  f.thumbTipAcross = t[0];
  f.thumbTipUp = t[1];
  f.thumbTipOut = t[2];
  f.indexHook = f.indexPip + f.indexDip;
  f.thumbExt = len(sub(P[4], P[2])) / ((len(sub(P[3], P[2])) + len(sub(P[4], P[3]))) || 1e-6);
  f.thumbBend = angle(sub(P[3], P[2]), sub(P[4], P[3])) + angle(sub(P[2], P[1]), sub(P[3], P[2]));
  f.thumbOpen = angle(sub(P[2], P[0]), sub(P[5], P[0])); // thumb base swung away from the index
  f.thumbReach = dist(4, 5);
  // Thumb tip between which fingers? Position across the hand relative to the knuckles,
  // 0 at the index knuckle, 1 at the pinky knuckle; negative is beyond the index (thumb side).
  const idxA = L[5][0], pkA = L[17][0];
  f.thumbSlot = (idxA - t[0]) / ((idxA - pkA) || 1e-6);

  // In a fist, which finger gaps does the thumb tip sit under, measured against the middle
  // joints (where the thumb crosses), 0 = index, 1 = middle, 2 = ring, 3 = little finger.
  const pipA = [L[6][0], L[10][0], L[14][0], L[18][0]];
  let slot = 0;
  if (t[0] >= pipA[0]) slot = -(t[0] - pipA[0]) / Math.max(1e-6, pipA[0] - pipA[1]);
  else if (t[0] <= pipA[3]) slot = 3 + (pipA[3] - t[0]) / Math.max(1e-6, pipA[2] - pipA[3]);
  else for (let k = 0; k < 3; k++) if (t[0] <= pipA[k] && t[0] >= pipA[k + 1]) slot = k + (pipA[k] - t[0]) / Math.max(1e-6, pipA[k] - pipA[k + 1]);
  f.thumbGap = slot;
  // Thumb in front of the bent fingers (S, E) or tucked behind them (M, N, T): depth of the
  // thumb tip compared with the index and middle finger middle joints.
  f.thumbFront = t[2] - (L[6][2] + L[10][2]) / 2;
  f.thumbBelowPip = (L[6][1] + L[10][1]) / 2 - t[1]; // + when the thumb tip is lower than the middle joints
  f.tipsBelowPip = ((L[6][1] - L[8][1]) + (L[10][1] - L[12][1])) / 2; // + when index and middle tips hang below their middle joints

  // Contacts (palm lengths)
  f.thumbIndexTip = dist(4, 8);
  f.thumbMiddleTip = dist(4, 12);
  f.thumbRingTip = dist(4, 16);
  f.thumbPinkyTip = dist(4, 20);
  f.thumbIndexPip = dist(4, 6);
  f.thumbMiddlePip = dist(4, 10);
  f.thumbRingPip = dist(4, 14);
  f.thumbIndexMcp = dist(4, 5);
  f.indexMiddleTip = dist(8, 12);
  f.middleRingTip = dist(12, 16);
  // Average distance from the curled fingertips to the thumb tip (E, O, C)
  f.tipsToThumb = (dist(8, 4) + dist(12, 4) + dist(16, 4) + dist(20, 4)) / 4;

  // Spread between neighbouring fingers (angle between knuckle-to-tip directions, in the palm plane)
  const flat = (i, j) => { const d = sub(L[j], L[i]); return [d[0], d[1], 0]; };
  f.spreadIM = angle(flat(5, 8), flat(9, 12));
  f.spreadMR = angle(flat(9, 12), flat(13, 16));
  f.spreadRP = angle(flat(13, 16), flat(17, 20));
  // Index and middle crossed (R): their tips swap sides compared with their knuckles.
  const order = L[5][0] - L[9][0];
  const tipOrder = L[8][0] - L[12][0];
  f.crossIM = order !== 0 ? -tipOrder / Math.abs(order) : 0; // > 0 when crossed

  // Orientation in the image. The *Tilt values ignore left and right: 0 = pointing up,
  // 90 = sideways, 180 = down. facing: 1 = palm to the camera, 0 = side on, -1 = back of the hand.
  const u = sub(P[9], P[0]);
  f.handDir = Math.atan2(u[0], -u[1]) * DEG;
  f.handTilt = Math.abs(f.handDir);
  for (const name of FINGERS) f[`${name}Tilt`] = Math.abs(f[`${name}Dir`]);
  const td = sub(P[4], P[2]);
  f.thumbTilt = Math.abs(Math.atan2(td[0], -td[1]) * DEG);
  f.facing = -normal[2];
  f.flipped = flipped ? 1 : 0;
  f.L = L;
  return f;
}
