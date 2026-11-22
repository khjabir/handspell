// The ASL manual alphabet: how to make each letter (for learners) and what it looks like to
// the recogniser.
//
// Every letter is described by the same set of measurements (FEATURE_SET, from features.js).
// `key` marks the measurements that define the letter, with a higher weight; the rest count
// a little (BASE_WEIGHT) so letters stay distinct. Some letters have more than one variant
// because people make them differently, for example M with the fingers draped forward over
// the thumb, or curled into a fist.
//
// The acceptable range of every measurement lives in tuned.js. Those ranges were fitted to
// MediaPipe landmarks from three public ASL alphabet collections (at least seven signers), with each
// collection weighted equally (see the README).
//
// A condition is { f: feature, lo, hi, s, w }: full marks inside lo..hi, falling to zero `s`
// beyond it, weighted by `w`. A letter scores the weighted geometric mean of its conditions,
// so one badly missed condition pulls the whole letter down.

/** The measurements every letter is described by. */
export const FEATURE_SET = [
  'indexCurl', 'middleCurl', 'ringCurl', 'pinkyCurl', 'indexExt', 'middleExt', 'indexMcp', 'indexHook',
  'thumbGap', 'thumbSlot', 'thumbTipUp', 'thumbFront', 'thumbBelowPip', 'thumbIndexTip', 'thumbMiddleTip', 'thumbMiddlePip',
  'tipsToThumb', 'spreadIM', 'spreadMR', 'crossIM', 'indexTilt', 'middleTilt', 'pinkyTilt', 'thumbTilt', 'handTilt',
];
/** Weight of a measurement that is not one of the letter's defining ones. */
export const BASE_WEIGHT = 0.5;

export const LETTERS = {
  A: {
    how: 'Make a fist and rest your thumb against the side of your index finger, pointing up.',
    tip: 'Keep the thumb beside the fingers, not across them (that makes S).',
    variants: [{ key: { thumbGap: 3, thumbTipUp: 2, indexCurl: 1.5, middleCurl: 1.5, indexExt: 1.5 } }],
  },
  B: {
    how: 'Hold your four fingers straight up and together, and fold your thumb across your palm.',
    tip: 'Keep the fingers touching each other.',
    variants: [{ key: { indexCurl: 2, middleCurl: 2, ringCurl: 2, pinkyCurl: 2, spreadIM: 1.5, thumbSlot: 2, thumbTipUp: 1.5 } }],
  },
  C: {
    how: 'Curve your fingers and thumb into the shape of a C, as if holding a cup.',
    tip: 'Leave a gap between your thumb and fingers. Closing it makes O.',
    variants: [{ key: { indexCurl: 2, middleCurl: 2, indexExt: 2, thumbIndexTip: 3, tipsToThumb: 2 } }],
  },
  D: {
    how: 'Point your index finger up. Touch the tips of your other fingers to your thumb, making a circle.',
    tip: 'The circle under the index finger is what makes it a D.',
    variants: [{ key: { indexCurl: 2, indexExt: 2, middleCurl: 2, ringCurl: 1.5, thumbMiddleTip: 2.5, indexTilt: 1.5 } }],
  },
  E: {
    how: 'Curl your fingertips down to touch your thumb, which is folded low across your palm.',
    tip: 'The fingertips rest on the thumb. In S the thumb wraps over the fingers instead.',
    variants: [{ key: { indexCurl: 1.5, middleCurl: 1.5, thumbTipUp: 3, thumbBelowPip: 2.5, tipsToThumb: 2 } }],
  },
  F: {
    how: 'Touch the tip of your index finger to your thumb, and hold your other three fingers up and apart.',
    tip: 'It looks like the OK sign.',
    variants: [{ key: { thumbIndexTip: 3, indexCurl: 2, middleCurl: 2, ringCurl: 2, pinkyCurl: 1.5 } }],
  },
  G: {
    how: 'Point your index finger sideways, with your thumb parallel above it. Fold the other fingers.',
    tip: 'The hand is on its side. Pointing down makes Q.',
    variants: [{ key: { indexCurl: 2, middleCurl: 2, indexTilt: 3, handTilt: 2, thumbIndexTip: 1.5 } }],
  },
  H: {
    how: 'Point your index and middle fingers sideways, together. Fold the other fingers.',
    tip: 'Like U, turned on its side.',
    variants: [{ key: { indexCurl: 2, middleCurl: 2, ringCurl: 2, indexTilt: 3, middleTilt: 2.5, spreadIM: 1.5 } }],
  },
  I: {
    how: 'Make a fist and hold your little finger straight up.',
    tip: 'The thumb crosses in front of the other fingers.',
    variants: [{ key: { indexCurl: 2, middleCurl: 2, ringCurl: 2, pinkyCurl: 3, pinkyTilt: 1.5 } }],
  },
  J: {
    how: 'Make an I, then draw a J in the air with your little finger: down, then curving towards your body.',
    tip: 'Turn your wrist as you draw the hook of the J.',
    motion: 'J',
    variants: [{ key: { indexCurl: 2, middleCurl: 2, ringCurl: 2, pinkyCurl: 3 } }],
  },
  K: {
    how: 'Hold your index and middle fingers up in a V, and put your thumb up between them, touching the middle finger.',
    tip: 'Like V with the thumb poking up in the middle.',
    variants: [{ key: { indexCurl: 2, middleCurl: 1.5, ringCurl: 2, pinkyCurl: 2, thumbTipUp: 3, thumbMiddlePip: 3, crossIM: 1.5 } }],
  },
  L: {
    how: 'Hold your index finger up and your thumb out to the side, making an L.',
    tip: 'Fold the other three fingers.',
    variants: [{ key: { indexCurl: 2.5, middleCurl: 2, ringCurl: 1.5, thumbSlot: 3, thumbIndexTip: 2.5 } }],
  },
  M: {
    how: 'Fold your thumb under your first three fingers, so its tip peeks out between the ring and little fingers.',
    tip: 'Three fingers over the thumb for M, two for N.',
    variants: [
      { name: 'draped', pick: (f) => f.indexMcp > 65, key: { indexMcp: 3, indexExt: 2, thumbTipUp: 2.5, thumbGap: 2.5, ringCurl: 1.5, pinkyCurl: 1.5 } },
      { name: 'fist', pick: (f) => f.indexMcp <= 65, key: { indexCurl: 1.5, middleCurl: 1.5, thumbGap: 3, thumbFront: 2, thumbTipUp: 1.5 } },
    ],
  },
  N: {
    how: 'Fold your thumb under your index and middle fingers, so its tip peeks out between the middle and ring fingers.',
    tip: 'Two fingers over the thumb for N, three for M.',
    variants: [
      { name: 'draped', pick: (f) => f.indexMcp > 65, key: { indexMcp: 3, indexExt: 2, thumbTipUp: 2.5, thumbGap: 2.5, ringCurl: 2.5, pinkyCurl: 2 } },
      { name: 'fist', pick: (f) => f.indexMcp <= 65, key: { indexCurl: 1.5, middleCurl: 1.5, thumbGap: 3, thumbFront: 2, thumbTipUp: 1.5 } },
    ],
  },
  O: {
    how: 'Curve all your fingers to meet your thumb, making an O.',
    tip: 'The fingertips touch the thumb. Leave a gap and it becomes C.',
    variants: [{ key: { indexCurl: 2, middleCurl: 2, thumbIndexTip: 3, tipsToThumb: 3, indexExt: 1.5 } }],
  },
  P: {
    how: 'Make a K and point it down, with the middle finger pointing at the floor.',
    tip: 'Turn your wrist so the palm faces down.',
    variants: [{ key: { indexCurl: 2, middleExt: 2, ringCurl: 1.5, indexTilt: 3, middleTilt: 3, handTilt: 1.5 } }],
  },
  Q: {
    how: 'Make a G and point it down: index finger and thumb pointing at the floor.',
    tip: 'Like G, turned downwards.',
    variants: [{ key: { middleCurl: 2, ringCurl: 2, indexTilt: 3, thumbTilt: 3, handTilt: 1.5 } }],
  },
  R: {
    how: 'Hold your index and middle fingers up and cross the middle finger over the index.',
    tip: 'Like crossing your fingers for luck.',
    variants: [{ key: { indexCurl: 2, middleCurl: 2, ringCurl: 2, pinkyCurl: 2, crossIM: 4 } }],
  },
  S: {
    how: 'Make a fist with your thumb wrapped across the front of your fingers.',
    tip: 'Thumb across the fingers for S, beside them for A.',
    variants: [{ key: { indexCurl: 1.5, middleCurl: 1.5, indexExt: 2, thumbGap: 3, thumbTipUp: 2, thumbFront: 2, tipsToThumb: 1.5 } }],
  },
  T: {
    how: 'Make a fist and tuck your thumb up between your index and middle fingers.',
    tip: 'The thumb tip peeks out between the index and middle fingers.',
    variants: [
      { name: 'beside', pick: (f) => f.thumbGap < -0.8, key: { indexExt: 2.5, indexCurl: 2, middleCurl: 1.5, thumbGap: 2, thumbTipUp: 2, thumbIndexPip: 2 } },
      { name: 'between', pick: (f) => f.thumbGap >= -0.8, key: { indexCurl: 1.5, middleCurl: 1.5, thumbGap: 3, thumbTipUp: 2, thumbIndexPip: 2, thumbFront: 2 } },
    ],
  },
  U: {
    how: 'Hold your index and middle fingers straight up, together. Fold the other fingers.',
    tip: 'Keep the two fingers touching. Spreading them makes V.',
    variants: [{ key: { indexCurl: 2, middleCurl: 2, ringCurl: 2, pinkyCurl: 2, spreadIM: 3, crossIM: 3, indexTilt: 1.5 } }],
  },
  V: {
    how: 'Hold your index and middle fingers up in a V. Fold the other fingers.',
    tip: 'The peace sign. Spread the two fingers apart.',
    variants: [{ key: { indexCurl: 2, middleCurl: 2, ringCurl: 2, pinkyCurl: 2, spreadIM: 3, crossIM: 3, thumbMiddlePip: 2 } }],
  },
  W: {
    how: 'Hold your index, middle and ring fingers up and apart. Touch your thumb to your little finger.',
    tip: 'Three fingers up.',
    variants: [{ key: { indexCurl: 2, middleCurl: 2, ringCurl: 3, pinkyCurl: 3 } }],
  },
  X: {
    how: 'Make a fist and raise your index finger, bent into a hook.',
    tip: 'Only the index finger, curved like a hook.',
    variants: [{ key: { indexHook: 3, indexExt: 2.5, middleCurl: 2, ringCurl: 1.5, thumbMiddleTip: 1 } }],
  },
  Y: {
    how: 'Stick out your thumb and little finger. Fold the middle three fingers.',
    tip: 'The "hang loose" sign.',
    variants: [{ key: { indexCurl: 2, middleCurl: 2, ringCurl: 2, pinkyCurl: 3, thumbSlot: 3, thumbIndexTip: 2 } }],
  },
  Z: {
    how: 'Point your index finger and draw a Z in the air.',
    tip: 'Across, diagonally back and down, then across again.',
    motion: 'Z',
    variants: [{ key: { indexCurl: 3, middleCurl: 2, ringCurl: 2, pinkyCurl: 1.5 } }],
  },
};

// Every variant gets one condition per measurement in FEATURE_SET; its range comes from tuned.js.
for (const def of Object.values(LETTERS)) {
  for (const v of def.variants) {
    v.spec = FEATURE_SET.map((f) => ({ f, lo: -Infinity, hi: Infinity, s: 1, w: v.key[f] || BASE_WEIGHT, untuned: true }));
  }
}

export const ALPHABET = Object.keys(LETTERS);
/** Letters that are made with a movement rather than held still. */
export const MOVING = ALPHABET.filter((l) => LETTERS[l].motion);

/** Apply fitted ranges: tuned = { 'M.0': [[lo, hi, s], ...] } in the same order as the spec. */
export function applyTuning(tuned) {
  for (const [letter, def] of Object.entries(LETTERS)) {
    def.variants.forEach((v, i) => {
      const t = tuned[`${letter}.${i}`];
      if (!t) return;
      v.spec.forEach((c, k) => {
        if (!t[k]) return;
        [c.lo, c.hi, c.s] = t[k];
        c.untuned = false;
      });
    });
  }
}
