// Turns MediaPipe results, frame by frame, into steady ISL letter guesses. Has the same
// interface as ../live.js (the ASL version), so the modes don't need to know which is in use.
//
// Each picture is measured twice, as seen and mirrored, and every letter keeps its better
// score, so it doesn't matter which hand leads. The signer's own recorded letters, if any, are
// blended in by the matcher.
import { measurePair, pickHands, PAIR_KEYS } from './features.js';
import { Matcher } from './matcher.js';
import { ISL_DATA } from './examples.js';
import { ISL_LETTERS, ISL_ALPHABET } from './letters.js';
import { islHint } from './hints.js';

const SMOOTH = 0.45; // weight of the newest frame in the running average of letter scores
const HOLD = 0.5; // seconds a lost hand is assumed to stay put (see #withHeldHand)

/** How sure the matcher must be. Its scores run lower than the ASL recogniser's. */
export const ISL_STRICTNESS = {
  relaxed: { need: 0.2, margin: 0.08 },
  normal: { need: 0.3, margin: 0.05 },
  strict: { need: 0.45, margin: 0.02 },
};

const mirrored = (hands) => hands.map((h) => ({
  lm: h.lm.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z })),
  label: h.label === 'Left' ? 'Right' : 'Left',
}));

export class IslLive {
  constructor() {
    this.id = 'isl';
    this.matcher = Matcher.fromPacked(ISL_DATA);
    this.matcher.twoHanded = new Set(ISL_ALPHABET.filter((l) => ISL_LETTERS[l].hands === 2));
    this.level = ISL_STRICTNESS.normal;
    this.ema = Object.fromEntries(ISL_ALPHABET.map((l) => [l, 0]));
    this.lastSeen = -10;
    this.state = null;
    this.top = null;
    this.pair = null; // the last two hands seen together: { hands, t }
  }

  setStrictness(key) {
    this.level = ISL_STRICTNESS[key] || ISL_STRICTNESS.normal;
  }

  /** The signer's own examples: { letter: [templates from templateOf] } */
  setTemplates(templates) {
    this.matcher.setOwn(templates || {});
  }

  /** What to save when the signer records a letter. */
  templateOf(f) {
    const t = {};
    for (const k of PAIR_KEYS) if (Number.isFinite(f[k])) t[k] = Math.round(f[k] * 1000) / 1000;
    return t;
  }

  hintFor(letter, f) { return islHint(letter, f, ISL_DATA.ranges); }

  reset() {
    for (const l of ISL_ALPHABET) this.ema[l] = 0;
    this.state = null;
    this.top = null;
    this.pair = null;
  }

  /**
   * The tracker sometimes loses one of two hands for a moment, usually when they touch. If one
   * hand vanishes while the other stays where it was, the lost hand is assumed to be where it
   * was last seen, for up to HOLD seconds.
   */
  #withHeldHand(hands, aspect, t) {
    if (hands.length >= 2) {
      this.pair = { hands, t };
      return { hands, held: false };
    }
    const p = this.pair;
    if (!p || t - p.t > HOLD || hands.length !== 1) return { hands, held: false };
    const h = hands[0];
    const palm = Math.hypot((h.lm[9].x - h.lm[0].x) * aspect, h.lm[9].y - h.lm[0].y) || 1e-6;
    const gap = (q) => Math.hypot((q.lm[0].x - h.lm[0].x) * aspect, q.lm[0].y - h.lm[0].y) / palm;
    const [p0, p1] = p.hands;
    const same = gap(p0) <= gap(p1) ? 0 : 1;
    if (gap(p.hands[same]) > 0.6) return { hands, held: false }; // the hand has moved on
    return { hands: [h, p.hands[1 - same]], held: true };
  }

  /**
   * @param {object} result MediaPipe HandLandmarker result
   * @param {number} aspect video width / height
   * @param {(p:{x:number,y:number}) => {x:number,y:number}} toScreen raw normalised point to screen pixels
   * @param {number} t time in seconds
   * @param {object} [face] { eyes: [{x, y}, {x, y}] } in raw picture coordinates, if a face was seen
   */
  update(result, aspect, toScreen, t, face) {
    const lms = ((result && result.landmarks) || []).slice(0, 2);
    if (!lms.length) {
      if (t - this.lastSeen > 0.4) this.reset();
      this.state = this.state && t - this.lastSeen < 0.4 ? this.state : null;
      return this.state;
    }
    const labels = (result.handedness || []).map((h) => (h && h[0] ? h[0].categoryName : 'Left'));
    const seen = lms.map((lm, i) => ({ lm, label: labels[i] || 'Left' }));
    const { hands, held } = this.#withHeldHand(seen, aspect, t);
    const f = measurePair(hands, { aspect });
    const fm = measurePair(mirrored(hands), { aspect });

    // The face, for I: how far the nearest index fingertip is from an eye, in palm lengths
    if (face && face.eyes && face.eyes.length) {
      let best = Infinity;
      for (const { lm } of seen) {
        const palm = Math.hypot((lm[9].x - lm[0].x) * aspect, lm[9].y - lm[0].y) || 1e-6;
        for (const e of face.eyes) best = Math.min(best, Math.hypot((lm[8].x - e.x) * aspect, lm[8].y - e.y) / palm);
      }
      f.eyeDist = fm.eyeDist = best;
    }

    const a = this.matcher.rank(f, ISL_ALPHABET);
    const b = this.matcher.rank(fm, ISL_ALPHABET);
    const score = {};
    for (const x of a) score[x.letter] = x.score;
    for (const x of b) if (x.score > score[x.letter]) score[x.letter] = x.score;
    // Keep the measurements of whichever way round matched best, for the hints
    const features = b[0].score > a[0].score ? fm : f;

    // I is pointing at your own face. With the face in view, its position settles it.
    if (Number.isFinite(f.eyeDist)) {
      if (f.eyeDist < 1.1 && f.nHands === 1) score.I = Math.max(score.I, 0.62);
      else if (f.eyeDist > 2.6) score.I *= 0.6;
    }

    for (const l of ISL_ALPHABET) this.ema[l] = this.ema[l] * (1 - SMOOTH) + score[l] * SMOOTH;
    const smoothed = ISL_ALPHABET.map((l) => ({ letter: l, score: this.ema[l] })).sort((p, q) => q.score - p.score);

    // Screen points of the hands actually seen: hand "a" (on the right of the picture) first
    const pick = pickHands(seen);
    const order = pick.b >= 0 ? [pick.a, pick.b] : [pick.a];
    const screens = order.map((i) => seen[i].lm.map(toScreen));
    const palmPx = screens.reduce((s, P) => s + Math.hypot(P[9].x - P[0].x, P[9].y - P[0].y), 0) / screens.length || 1;

    if (!this.top || this.top.letter !== smoothed[0].letter) this.top = { letter: smoothed[0].letter, since: t };
    this.lastSeen = t;
    this.state = {
      t,
      features,
      ranked: smoothed,
      top: smoothed[0],
      second: smoothed[1],
      screen: screens[0],
      hands: screens,
      palmPx,
      nHands: lms.length, // hands seen in this frame
      held, // a lost hand was filled in from a moment ago
      motion: null,
    };
    return this.state;
  }

  /** Is the signer making `letter` right now? */
  accepts(letter, t) {
    const s = this.state;
    if (!s || t - s.t > 0.3) return false;
    const r = s.ranked.find((x) => x.letter === letter);
    if (!r || r.score < this.level.need) return false;
    return r.score >= s.ranked[0].score - this.level.margin;
  }

  /** The letter the hands most clearly show, or null. */
  best(t) {
    const s = this.state;
    if (!s || t - s.t > 0.3) return null;
    const [p, q] = s.ranked;
    if (p.score < this.level.need) return null;
    const steady = this.top && this.top.letter === p.letter && t - this.top.since > 0.3;
    if (p.score - q.score >= 0.04 || (steady && p.score - q.score >= 0.01)) return p.letter;
    return null;
  }

}
