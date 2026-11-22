// Scores a measured handshape against every letter and picks the most likely ones.
import { LETTERS, ALPHABET, applyTuning } from './letters.js';
import { TUNED } from './tuned.js';

applyTuning(TUNED);

const FLOOR = 0.02;

function membership(x, c) {
  if (x >= c.lo && x <= c.hi) return 1;
  const d = x < c.lo ? c.lo - x : x - c.hi;
  return Math.max(0, 1 - d / c.s);
}

function scoreSpec(spec, f) {
  let sum = 0, wsum = 0, worst = null, worstM = 2;
  for (const c of spec) {
    if (c.untuned) continue;
    const x = f[c.f];
    if (x === undefined || Number.isNaN(x)) continue;
    const m = membership(x, c);
    sum += c.w * Math.log(Math.max(FLOOR, m));
    wsum += c.w;
    if (m < worstM) { worstM = m; worst = c; }
  }
  return { score: wsum ? Math.exp(sum / wsum) : 0, worst, worstM };
}

/** How well the measurements fit one letter (its best variant), 0..1, plus the condition that fits worst. */
export function scoreLetter(letter, f) {
  let best = null;
  for (const v of LETTERS[letter].variants) {
    const r = scoreSpec(v.spec, f);
    if (!best || r.score > best.score) best = r;
  }
  return best;
}

/**
 * What is most off for a letter: its best variant's conditions, worst first, weighing how far
 * off each one is by how much it matters. Each entry says whether the value is too low or high.
 */
export function explain(letter, f) {
  let bestV = null, bestScore = -1;
  for (const v of LETTERS[letter].variants) {
    const r = scoreSpec(v.spec, f);
    if (r.score > bestScore) { bestScore = r.score; bestV = v; }
  }
  return bestV.spec
    .filter((c) => !c.untuned && Number.isFinite(f[c.f]))
    .map((c) => {
      const x = f[c.f];
      const m = membership(x, c);
      return { f: c.f, w: c.w, miss: (1 - m) * c.w, dir: x < c.lo ? 'low' : x > c.hi ? 'high' : 'ok' };
    })
    .filter((e) => e.dir !== 'ok')
    .sort((a, b) => b.miss - a.miss);
}

/** All letters, best first. */
export function rank(f, letters = ALPHABET) {
  return letters.map((l) => ({ letter: l, ...scoreLetter(l, f) })).sort((a, b) => b.score - a.score);
}

/**
 * Personal examples ("teach it your hand"): stored measurements of the user's own letters.
 * A close match to one of them boosts that letter.
 */
const TEMPLATE_KEYS = [
  'indexCurl', 'middleCurl', 'ringCurl', 'pinkyCurl', 'indexPip', 'middlePip',
  'thumbSlot', 'thumbTipUp', 'thumbIndexTip', 'thumbMiddleTip', 'tipsToThumb',
  'spreadIM', 'crossIM', 'indexTilt', 'middleTilt', 'pinkyTilt', 'thumbTilt', 'handTilt',
];
const TEMPLATE_SCALE = {
  indexCurl: 40, middleCurl: 40, ringCurl: 40, pinkyCurl: 40, indexPip: 35, middlePip: 35,
  thumbSlot: 0.35, thumbTipUp: 0.2, thumbIndexTip: 0.2, thumbMiddleTip: 0.2, tipsToThumb: 0.15,
  spreadIM: 12, crossIM: 0.6, indexTilt: 30, middleTilt: 30, pinkyTilt: 30, thumbTilt: 40, handTilt: 30,
};

export function templateOf(f) {
  const t = {};
  for (const k of TEMPLATE_KEYS) t[k] = +f[k].toFixed(3);
  return t;
}

function templateDistance(a, b) {
  let s = 0;
  for (const k of TEMPLATE_KEYS) {
    const d = (a[k] - b[k]) / TEMPLATE_SCALE[k];
    s += d * d;
  }
  return Math.sqrt(s / TEMPLATE_KEYS.length);
}

/** How sure the check must be: the right letter must score at least `need` and be the best
 *  guess, or within `margin` of it. Measured on photos of a signer the ranges were not fitted
 *  to, "normal" accepts 84% of correct letters and the closest wrong letter 16% of the time. */
export const STRICTNESS = {
  relaxed: { need: 0.35, margin: 0.06 },
  normal: { need: 0.45, margin: 0.03 },
  strict: { need: 0.55, margin: 0 },
};

export class Recognizer {
  constructor() {
    /** @type {Record<string, object[]>} letter -> list of templates */
    this.templates = {};
    this.level = STRICTNESS.normal;
  }

  setTemplates(t) { this.templates = t || {}; }
  setStrictness(name) { this.level = STRICTNESS[name] || STRICTNESS.normal; }

  /**
   * Rank the letters for one measured hand. Personal templates, when present, blend in:
   * the closer the nearest example, the more it counts.
   */
  rank(f, letters = ALPHABET) {
    const ranked = rank(f, letters);
    if (!Object.keys(this.templates).length) return ranked;
    for (const r of ranked) {
      const list = this.templates[r.letter];
      if (!list || !list.length) continue;
      let best = Infinity;
      for (const t of list) best = Math.min(best, templateDistance(f, t));
      const sim = Math.exp(-best * best * 1.6); // 1 when identical, about 0.2 at distance 1
      r.personal = sim;
      r.score = Math.max(r.score * 0.55 + sim * 0.45, Math.min(1, sim * 1.05));
    }
    return ranked.sort((a, b) => b.score - a.score);
  }

  /** Does a ranking say the hand is making `target`? */
  accepts(ranked, target) {
    const mine = ranked.find((r) => r.letter === target);
    const best = ranked[0];
    if (!mine) return false;
    return mine.score >= this.level.need && (best.letter === target || mine.score >= best.score - this.level.margin);
  }
}
