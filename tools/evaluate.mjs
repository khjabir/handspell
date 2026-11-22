// Accuracy of the recogniser on the landmark data, per source and per letter.
//
//   node tools/evaluate.mjs                     (in-sample if tuned.js was fitted on everything)
//   HOLDOUT=T,D,E node tools/tune.mjs && HOLDOUT=D,E node tools/evaluate.mjs
//
// The second line measures signers the ranges were not fitted to: T (ASL Alphabet Test) and
// Surrey signers D and E. Run `node tools/tune.mjs` afterwards to restore the shipped ranges.
import { readFileSync } from 'node:fs';
import { toPoints, measure } from '../src/sign/features.js';
import { rank, Recognizer } from '../src/sign/recognizer.js';

const rows = JSON.parse(readFileSync(new URL('./data/samples.json', import.meta.url), 'utf8'));
const STATIC = 'ABCDEFGHIKLMNOPQRSTUVWXY'.split('');
const HELD = new Set((process.env.HOLDOUT || 'D,E').split(',').filter(Boolean));
const src = (s) => (s === 'K' ? 'K' : s === 'T' ? 'T' : HELD.has(s) ? 'S-heldout' : 'S-train');
const stats = {}; // src -> {n, top1, top3, verify, falseAccept}
const perLetter = {}; // letter -> {n, ok}
const conf = {}; // "A>S" counts
const rec = new Recognizer();
let i = 0;
for (const r of rows) {
  const [label, signer, method, hand, ...v] = r;
  if (!STATIC.includes(label)) continue;
  const s = src(signer);
  // Surrey is 5 signers x many frames; use every 3rd frame to keep it quick
  if (s === 'S-train' && (i++ % 3)) continue;
  const lm = []; for (let k = 0; k < 21; k++) lm.push([v[k * 3], v[k * 3 + 1], v[k * 3 + 2]]);
  const f = measure(toPoints(lm, { mirror: hand === 'Right' }));
  const ranked = rank(f, STATIC);
  const st = (stats[s] ||= { n: 0, top1: 0, top3: 0, verify: 0, fa: 0, faN: 0 });
  st.n++;
  if (ranked[0].letter === label) st.top1++;
  else conf[`${label}>${ranked[0].letter}`] = (conf[`${label}>${ranked[0].letter}`] || 0) + 1;
  if (ranked.slice(0, 3).some((x) => x.letter === label)) st.top3++;
  const okRight = rec.accepts(ranked, label);
  if (okRight) st.verify++;
  // false accept: would the hardest wrong target (the best other letter) be accepted?
  const other = ranked.find((x) => x.letter !== label);
  st.faN++; if (rec.accepts(ranked, other.letter)) st.fa++;
  const pl = (perLetter[label] ||= { n: 0, ok: 0, v: 0, bySrc: {} });
  pl.n++; if (ranked[0].letter === label) pl.ok++; if (okRight) pl.v++;
  const b = (pl.bySrc[s] ||= [0, 0]); b[0]++; if (ranked[0].letter === label) b[1]++;
}
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) : '-');
for (const [s, st] of Object.entries(stats)) {
  console.log(`${s}: n=${st.n} top1=${pct(st.top1, st.n)}% top3=${pct(st.top3, st.n)}% accepted=${pct(st.verify, st.n)}% nearest wrong letter accepted=${pct(st.fa, st.faN)}%`);
}
console.log('per letter top1 [heldout/S-train/T/K] and verify:');
console.log(STATIC.map((l) => {
  const p = perLetter[l]; if (!p) return `${l}:-`;
  const bs = ['S-heldout', 'S-train', 'T', 'K'].map((s) => (p.bySrc[s] ? pct(p.bySrc[s][1], p.bySrc[s][0]) : '-')).join('/');
  return `${l} ${pct(p.ok, p.n)} [${bs}] v${pct(p.v, p.n)}`;
}).join('\n'));
console.log('top confusions:', Object.entries(conf).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => `${k}:${v}`).join(' '));
