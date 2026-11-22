// Turns MediaPipe results, frame by frame, into steady letter guesses.
import { toPoints, measure } from './features.js';
import { Recognizer, templateOf } from './recognizer.js';
import { hintFor } from './hints.js';
import { ALPHABET } from './letters.js';
import { MotionTracker } from './motion.js';

const SMOOTH = 0.45; // weight of the newest frame in the running average of letter scores

export class LiveSign {
  constructor() {
    this.id = 'asl';
    this.recognizer = new Recognizer();
    this.motion = new MotionTracker();
    this.signingHand = 'right';
    this.ema = Object.fromEntries(ALPHABET.map((l) => [l, 0]));
    this.labelVotes = [];
    this.lastSeen = -10;
    this.state = null;
    this.motionHits = { J: -10, Z: -10 };
    this.top = null;
  }

  setStrictness(key) { this.recognizer.setStrictness(key); }
  setTemplates(templates) { this.recognizer.setTemplates(templates); }
  /** What to save when the signer records a letter. */
  templateOf(f) { return templateOf(f); }
  hintFor(letter, f) { return hintFor(letter, f); }

  reset() {
    for (const l of ALPHABET) this.ema[l] = 0;
    this.labelVotes = [];
    this.motion.reset();
    this.state = null;
  }

  /**
   * @param {object} result MediaPipe HandLandmarker result
   * @param {number} aspect video width / height
   * @param {(p:{x:number,y:number}) => {x:number,y:number}} toScreen raw normalised point to screen pixels
   * @param {number} t time in seconds
   */
  update(result, aspect, toScreen, t) {
    const hands = (result && result.landmarks) || [];
    if (!hands.length) {
      if (t - this.lastSeen > 0.4) this.reset();
      this.state = this.state && t - this.lastSeen < 0.4 ? this.state : null;
      return this.state;
    }
    // MediaPipe names hands as if the picture were mirrored: on our unmirrored frames a
    // right hand is labelled "Left". Prefer the signing hand, otherwise the biggest one.
    const want = this.signingHand === 'right' ? 'Left' : 'Right';
    const labels = (result.handedness || []).map((h) => (h && h[0] ? h[0].categoryName : null));
    const size = (lm) => Math.hypot(lm[9].x - lm[0].x, (lm[9].y - lm[0].y) / aspect);
    let pick = labels.indexOf(want);
    if (pick < 0) pick = hands.map((lm, i) => [size(lm), i]).sort((a, b) => b[0] - a[0])[0][1];
    const lm = hands[pick];

    // Keep the label steady: MediaPipe occasionally flips it for a frame or two.
    this.labelVotes.push(labels[pick] || want);
    if (this.labelVotes.length > 9) this.labelVotes.shift();
    const rightVotes = this.labelVotes.filter((l) => l === 'Right').length;
    const label = rightVotes * 2 > this.labelVotes.length ? 'Right' : 'Left';

    const f = measure(toPoints(lm, { aspect, mirror: label === 'Right' }));
    const ranked = this.recognizer.rank(f);
    for (const r of ranked) this.ema[r.letter] = this.ema[r.letter] * (1 - SMOOTH) + r.score * SMOOTH;
    const smoothed = ALPHABET.map((l) => ({ letter: l, score: this.ema[l] })).sort((a, b) => b.score - a.score);

    // Fingertips on screen for the J and Z movements
    const screen = lm.map(toScreen);
    const palmPx = Math.hypot(screen[9].x - screen[0].x, screen[9].y - screen[0].y) || 1;
    const shapeJ = this.ema.J > 0.3 || this.ema.I > 0.3;
    const shapeZ = this.ema.Z > 0.3 || this.ema.D > 0.3 || this.ema.G > 0.3 || this.ema.X > 0.3;
    const moved = this.motion.push(t, screen[20], screen[8], palmPx, { J: shapeJ, Z: shapeZ });
    if (moved) this.motionHits[moved] = t;

    if (!this.top || this.top.letter !== smoothed[0].letter) this.top = { letter: smoothed[0].letter, since: t };
    this.lastSeen = t;
    this.state = {
      t,
      features: f,
      ranked: smoothed,
      raw: ranked,
      top: smoothed[0],
      second: smoothed[1],
      screen,
      palmPx,
      label,
      motion: moved,
    };
    return this.state;
  }

  /** Is the hand making `letter` right now? J and Z also need their movement. */
  accepts(letter, t) {
    const s = this.state;
    if (!s || t - s.t > 0.3) return false;
    if (letter === 'J' || letter === 'Z') return t - this.motionHits[letter] < 0.6;
    return this.recognizer.accepts(s.ranked.filter((r) => r.letter !== 'J' && r.letter !== 'Z'), letter);
  }

  /** The letter the hand most clearly shows, or null. */
  best(t) {
    const s = this.state;
    if (!s || t - s.t > 0.3) return null;
    for (const m of ['J', 'Z']) if (t - this.motionHits[m] < 0.6) return m;
    const ranked = s.ranked.filter((r) => r.letter !== 'J' && r.letter !== 'Z');
    const [a, b] = ranked;
    if (a.score < this.recognizer.level.need) return null;
    // A clear lead, or a small lead that has lasted a moment
    const steady = this.top && this.top.letter === a.letter && t - this.top.since > 0.3;
    if (a.score - b.score >= 0.04 || (steady && a.score - b.score >= 0.01)) return a.letter;
    return null;
  }
}
