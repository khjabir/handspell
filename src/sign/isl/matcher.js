// Matches ISL measurements against example handshapes: built-in examples (from the public
// datasets, see the README) plus the signer's own recorded letters, which count for more.
import { PAIR_KEYS } from './features.js';

/** How much each kind of measurement counts. Contacts define ISL letters, so they count most. */
export function weightOf(key) {
  if (key.startsWith('t_') || key.startsWith('cross') || key.includes('OnPalm') || key.includes('_bPalm') || key.includes('_aPalm') || key.startsWith('aIndex_') || key.startsWith('aThumb_') || key.startsWith('bIndex_') || key === 'closestTips') return 1.5;
  if (key.startsWith('stack') || key === 'palms' || key === 'wrists' || key === 'indexAngle') return 1;
  if (key.endsWith('Tilt')) return 0.4;
  if (key === 'nHands') return 0;
  return 1;
}

export class Matcher {
  /**
   * @param {object} data { scale: {key: number}, examples: [{ l: letter, v: [values in KEYS order] }], keys: [...] }
   */
  constructor(data) {
    this.keys = data.keys || PAIR_KEYS;
    this.scale = this.keys.map((k) => data.scale[k] || 1);
    this.weight = this.keys.map(weightOf);
    this.builtin = data.examples.map((e) => ({ l: e.l, v: e.v, n: e.v[this.keys.indexOf('nHands')], own: false }));
    this.own = [];
    this.k = 9;
    this.twoHanded = new Set(data.twoHanded || []);
    this.oneHandDiscount = 0.75;
  }

  /** Unpack the built-in data from examples.js. */
  static fromPacked(d) {
    const bin = atob(d.examples);
    const n = d.keys.length + 1;
    const examples = [];
    for (let o = 0; o + n <= bin.length; o += n) {
      const byte = (i) => { const b = bin.charCodeAt(o + i); return b > 127 ? b - 256 : b; };
      const v = d.keys.map((k, i) => { const q = byte(i + 1); return q === -128 ? NaN : d.offset[k] + q * d.step[k]; });
      examples.push({ l: d.letters[byte(0)], v });
    }
    return new Matcher({ keys: d.keys, scale: d.scale, examples, twoHanded: d.twoHanded });
  }

  /** The signer's own examples: { letter: [measurement objects] } */
  setOwn(byLetter) {
    this.own = [];
    for (const [l, list] of Object.entries(byLetter || {})) {
      for (const f of list) this.own.push({ l, v: this.vector(f), n: f.nHands, own: true });
    }
  }

  vector(f) { return this.keys.map((k) => (Number.isFinite(f[k]) ? f[k] : NaN)); }

  distance(a, b) {
    let s = 0, w = 0;
    for (let i = 0; i < a.length; i++) {
      const x = a[i], y = b[i];
      if (Number.isNaN(x) || Number.isNaN(y)) continue;
      const d = (x - y) / this.scale[i];
      s += this.weight[i] * Math.min(9, d * d);
      w += this.weight[i];
    }
    return w ? Math.sqrt(s / w) : 9;
  }

  /**
   * Scores for every letter (0..1), best first.
   * The built-in examples vote (nearest neighbours); the signer's own examples are then blended
   * in letter by letter, because they are the same hands, the same camera and the same habits.
   * @param {object} f measurements from measurePair
   * @param {string[]} letters
   */
  rank(f, letters) {
    const v = this.vector(f);
    const n = f.nHands;
    const near = [];
    for (const e of this.builtin) {
      let d = this.distance(v, e.v);
      if (e.n !== n) d += 0.6; // one hand seen where the example has two, or the other way round
      if (near.length < this.k || d < near[near.length - 1].d) {
        near.push({ l: e.l, d });
        near.sort((a, b) => a.d - b.d);
        if (near.length > this.k) near.pop();
      }
    }
    const votes = Object.fromEntries(letters.map((l) => [l, 0]));
    let total = 0;
    for (const s of near) {
      const w = Math.exp(-s.d * s.d * 2);
      if (votes[s.l] !== undefined) votes[s.l] += w;
      total += w;
    }
    const nd = near[0] ? near[0].d : 9;
    const closeness = Math.exp(-nd * nd * 0.9);
    const own = {};
    for (const e of this.own) {
      let d = this.distance(v, e.v);
      if (e.n !== n) d += 0.6;
      const sim = Math.exp(-d * d * 2);
      if (!(own[e.l] >= sim)) own[e.l] = sim;
    }
    return letters
      .map((l) => {
        let base = total ? (votes[l] / total) * (0.35 + 0.65 * closeness) : 0;
        // With one hand in view, a one-hand letter is the likelier reading (the tracker does miss
        // the second hand when hands overlap, so two-hand letters stay possible)
        if (n === 1 && this.twoHanded.has(l)) base *= this.oneHandDiscount;
        const sim = own[l];
        return { letter: l, score: sim === undefined ? base : Math.max(base * 0.55 + sim * 0.45, sim * 1.05), own: sim };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Rank a picture measured both ways round (as seen, and mirrored), keeping each letter's
   * better score, so either hand can lead.
   */
  rankBoth(f, fMirrored, letters) {
    const a = this.rank(f, letters);
    if (!fMirrored) return a;
    const best = Object.fromEntries(a.map((x) => [x.letter, x.score]));
    for (const x of this.rank(fMirrored, letters)) if (x.score > best[x.letter]) best[x.letter] = x.score;
    return letters.map((l) => ({ letter: l, score: best[l] })).sort((p, q) => p.score - q.score).reverse();
  }

  /** How well a letter is known: the number of the signer's own examples for it. */
  ownCount(letter) { return this.own.filter((e) => e.l === letter).length; }
}
