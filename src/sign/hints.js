// Plain-language advice for the measurement that is most off.
import { explain } from './recognizer.js';

const TURN = {
  G: 'Turn your hand on its side so your index finger points sideways',
  H: 'Turn your hand on its side so your two fingers point sideways',
  P: 'Point your fingers down towards the floor',
  Q: 'Point your index finger and thumb down',
};

// feature: [advice when the value is too low, advice when it is too high]
const HINTS = {
  indexCurl: ['Bend your index finger more', 'Straighten your index finger'],
  middleCurl: ['Bend your middle finger more', 'Straighten your middle finger'],
  ringCurl: ['Bend your ring finger more', 'Straighten your ring finger'],
  pinkyCurl: ['Bend your little finger more', 'Straighten your little finger'],
  indexExt: ['Straighten your index finger', 'Bend your index finger more'],
  middleExt: ['Straighten your middle finger', 'Bend your middle finger more'],
  indexMcp: ['Fold your fingers forward at the knuckles', 'Lift your fingers up at the knuckles'],
  indexHook: ['Hook your index finger more', 'Open the hook of your index finger a little'],
  thumbGap: ['Move your thumb across towards your little finger', 'Move your thumb back towards your index finger'],
  thumbSlot: ['Bring your thumb in across your palm', 'Move your thumb out to the side'],
  thumbTipUp: ['Raise your thumb', 'Lower your thumb'],
  thumbFront: ['Bring your thumb in front of your fingers', 'Tuck your thumb under your fingers'],
  thumbBelowPip: ['Fold your thumb lower, under your fingertips', 'Raise your thumb a little'],
  thumbIndexTip: ['Open a gap between your thumb and index finger', 'Bring your thumb and index finger together'],
  thumbMiddleTip: ['Move your thumb away from your middle finger', 'Touch your thumb to your middle finger'],
  thumbMiddlePip: ['Move your thumb away from your middle finger', 'Put your thumb against your middle finger'],
  tipsToThumb: ['Open your fingers away from your thumb', 'Bring your fingertips down to your thumb'],
  spreadIM: ['Spread your index and middle fingers apart', 'Hold your index and middle fingers together'],
  spreadMR: ['Spread your fingers apart', 'Keep your fingers together'],
  crossIM: ['Cross your middle finger over your index finger', 'Uncross your fingers'],
  indexTilt: ['Point your index finger more sideways', 'Point your index finger up'],
  middleTilt: ['Point your fingers more sideways', 'Point your fingers up'],
  pinkyTilt: ['Point your little finger more to the side', 'Point your little finger straight up'],
  thumbTilt: ['Point your thumb down', 'Point your thumb up'],
  handTilt: ['Tilt your hand more', 'Hold your hand upright'],
};

/** One short piece of advice for getting from the current handshape to `letter`. */
export function hintFor(letter, features) {
  const misses = explain(letter, features);
  if (!misses.length) return '';
  const top = misses[0];
  if (TURN[letter] && /Tilt$/.test(top.f) && top.dir === 'low') return TURN[letter];
  // Too little crossing on uncrossed fingers means they need spreading, not uncrossing
  if (top.f === 'crossIM' && top.dir === 'high' && features.crossIM < 0) return HINTS.spreadIM[0];
  const h = HINTS[top.f];
  return h ? h[top.dir === 'low' ? 0 : 1] : '';
}
