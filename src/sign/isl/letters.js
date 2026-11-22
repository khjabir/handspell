// The Indian Sign Language (ISL) manual alphabet, as shown on the chart from the Indian Sign
// Language Research and Training Centre (ISLRTC), and as the signers in the public photo
// collections make them. Most letters use both hands, one touching or resting on the other;
// either hand can lead. C, I, L, O, U and V use one hand.
//
// These descriptions were written from the chart and still need checking by a Deaf ISL signer
// or teacher; signing differs from place to place, and the camera is taught each signer's own
// version during setup.
//
// `hints` are what the learner hears when a letter isn't recognised: [measurement, 'hi' | 'lo',
// advice]. 'hi' gives the advice when the measurement is above the letter's usual range
// (for example the hands too far apart), 'lo' when it is below. The usual ranges come from the
// public ISL photo collections (see examples.js).

export const ISL_LETTERS = {
  A: {
    hands: 2,
    how: 'Make loose fists with both hands, thumbs up, and touch the tips of your thumbs together.',
    tip: 'The two thumbs meet in a point, like the top of an A.',
    hints: [['t_thumb_thumb', 'hi', 'Touch the tips of your two thumbs together'], ['a_middleCurl', 'lo', 'Curl your fingers into loose fists']],
  },
  B: {
    hands: 2,
    how: 'Curve the fingers and thumb of each hand, then touch the hands together at the fingertips and thumbs, making two loops side by side.',
    tip: 'Two round loops, like the two bumps of a B.',
    hints: [['t_index_index', 'hi', 'Touch your index fingertips together'], ['t_thumb_thumb', 'hi', 'Touch your thumb tips together']],
  },
  C: {
    hands: 1,
    how: 'Curve the fingers and thumb of one hand into the shape of a C.',
    tip: 'Leave a gap between your thumb and fingers. Closing it makes O.',
    hints: [['a_thumbIndexTip', 'lo', 'Open a gap between your thumb and fingers'], ['a_indexCurl', 'lo', 'Curve your fingers more']],
  },
  D: {
    hands: 2,
    how: 'Point one index finger up. Curve the thumb and index finger of your other hand into a half circle and touch both tips to the straight finger, making a D.',
    tip: 'The straight finger is the back of the D; your curved hand is its belly.',
    hints: [['b_indexCurl', 'hi', 'Point the straight index finger up'], ['aIndex_bIndexMid', 'hi', 'Touch your fingertips to the straight index finger']],
  },
  E: {
    hands: 2,
    how: 'Point one index finger up and touch its tip with the tip of your other index finger.',
    tip: 'Fingertip to fingertip.',
    hints: [['t_index_index', 'hi', 'Touch your two index fingertips together'], ['b_indexCurl', 'hi', 'Point the other index finger up straight']],
  },
  F: {
    hands: 2,
    how: 'Lay the index and middle fingers of one hand across the index and middle fingers of the other.',
    tip: 'Two fingers resting on two fingers, crossing at an angle.',
    hints: [['palms', 'hi', 'Bring your hands together'], ['a_middleCurl', 'hi', 'Straighten the two fingers lying across']],
  },
  G: {
    hands: 2,
    how: 'Make fists with both hands and rest one on top of the other.',
    tip: 'Two fists stacked.',
    hints: [['a_indexCurl', 'lo', 'Close both hands into fists'], ['palms', 'hi', 'Rest one fist right on top of the other']],
  },
  H: {
    hands: 2,
    move: 'brush',
    how: 'Hold one hand open, palm facing you. Brush your other hand across its palm, towards the fingers.',
    tip: 'A short brush across the palm.',
    hints: [['a_index_bPalm', 'hi', 'Lay your fingers across your open palm'], ['b_indexCurl', 'hi', 'Open the flat hand fully']],
  },
  I: {
    hands: 1,
    face: true,
    how: 'Point your index finger at your face and touch your cheek, just under your eye.',
    tip: 'Only the index finger is out.',
    hints: [['a_indexCurl', 'hi', 'Straighten your index finger'], ['a_middleCurl', 'lo', 'Fold your other fingers']],
  },
  J: {
    hands: 2,
    move: 'trace',
    how: 'Hold one hand with the thumb up and the index finger pointing sideways. With your other index finger, trace a J along that index finger and up the thumb.',
    tip: 'One hand is the page; the other index finger is the pen.',
    hints: [['aIndex_bIndexBase', 'hi', 'Touch your index fingertip to the other hand'], ['a_indexCurl', 'hi', 'Point with your index finger']],
  },
  K: {
    hands: 2,
    how: 'Point one index finger up. Bend your other index finger like a hook and rest it on top of the straight one.',
    tip: 'A hook resting on a post.',
    hints: [['t_index_index', 'hi', 'Rest the hooked finger on the tip of the straight one'], ['b_indexCurl', 'hi', 'Point the straight index finger up']],
  },
  L: {
    hands: 1,
    how: 'Hold your thumb out and your index finger up, making an L. Fold the other fingers.',
    tip: 'The L you might already know.',
    hints: [['a_middleCurl', 'lo', 'Fold your middle, ring and little fingers'], ['a_indexCurl', 'hi', 'Point your index finger straight up']],
  },
  M: {
    hands: 2,
    how: 'Hold one hand open, palm facing you. Lay the index, middle and ring fingers of your other hand across it.',
    tip: 'Three fingers for M, two for N.',
    hints: [['tipsOnPalm', 'lo', 'Lay three fingers across your open palm'], ['a_ringCurl', 'hi', 'Lay your ring finger down too']],
  },
  N: {
    hands: 2,
    how: 'Hold one hand open, palm facing you. Lay the index and middle fingers of your other hand across it.',
    tip: 'Two fingers for N, three for M.',
    hints: [['tipsOnPalm', 'lo', 'Lay two fingers across your open palm'], ['a_ringCurl', 'lo', 'Fold your ring and little fingers']],
  },
  O: {
    hands: 1,
    how: 'Bring all your fingertips together to touch your thumb, making a round O.',
    tip: 'Keep the inside of the O open.',
    hints: [['tipsToThumb', 'hi', 'Bring your fingertips down to your thumb'], ['a_thumbIndexTip', 'hi', 'Touch your thumb and index finger together']],
  },
  P: {
    hands: 2,
    how: 'Point one index finger up. Make a ring with the thumb and index finger of your other hand and hold it against the top of the straight finger.',
    tip: 'The straight finger with the ring at the top makes the P.',
    hints: [['a_thumbIndexTip', 'hi', 'Touch your thumb and index finger together into a ring'], ['t_index_index', 'hi', 'Hold the ring against the top of the straight finger']],
  },
  Q: {
    hands: 2,
    how: 'Point one index finger up. Curl the thumb and index finger of your other hand over its tip, like a hook.',
    tip: 'The ring hangs over the top of the finger.',
    hints: [['t_index_index', 'hi', 'Curl your thumb and index finger over the tip of the straight finger'], ['b_indexCurl', 'hi', 'Point the straight index finger up']],
  },
  R: {
    hands: 2,
    how: 'Hold one hand open, palm facing you. Curl the index finger of your other hand and touch it to that palm.',
    tip: 'One bent finger on the palm.',
    hints: [['a_index_bPalm', 'hi', 'Touch your bent index finger to the open palm'], ['b_indexCurl', 'hi', 'Open the flat hand fully']],
  },
  S: {
    hands: 2,
    how: 'Make loose fists and hook your little fingers together, one hand above the other.',
    tip: 'A little-finger promise.',
    hints: [['t_pinky_pinky', 'hi', 'Hook your little fingers together']],
  },
  T: {
    hands: 2,
    how: 'Point one index finger up and lay your other index finger across its tip, making a T.',
    tip: 'The lying finger is the bar of the T.',
    hints: [['bIndex_aIndexMid', 'hi', 'Lay one index finger across the tip of the other'], ['b_indexCurl', 'hi', 'Point the straight index finger up']],
  },
  U: {
    hands: 1,
    how: 'Hold your thumb and index finger up, a little apart, making a U. Curl the other fingers into your palm.',
    tip: 'The thumb and index finger are the two sides of the U.',
    hints: [['a_thumbIndexTip', 'lo', 'Open a gap between your thumb and index finger'], ['a_middleCurl', 'lo', 'Curl your middle, ring and little fingers']],
  },
  V: {
    hands: 1,
    how: 'Hold your index and middle fingers up and apart, in a V. Fold the other fingers.',
    tip: 'The peace sign.',
    hints: [['spreadIM', 'lo', 'Spread your two fingers apart'], ['a_ringCurl', 'lo', 'Fold your ring and little fingers']],
  },
  W: {
    hands: 2,
    how: 'Cross the fingers of both hands over each other, interlacing them.',
    tip: 'Fingers between fingers.',
    hints: [['palms', 'hi', 'Bring your hands together, fingers between fingers']],
  },
  X: {
    hands: 2,
    how: 'Cross your two index fingers, making an X.',
    tip: 'The other fingers stay folded.',
    hints: [['crossIndex', 'lo', 'Cross your index fingers over each other'], ['a_middleCurl', 'lo', 'Fold your other fingers']],
  },
  Y: {
    hands: 2,
    how: 'Spread the thumb and index finger of one hand into a V. Lay your other index finger in the V.',
    tip: 'The two hands together make the Y.',
    hints: [['aIndex_bIndexBase', 'hi', 'Lay your index finger in the V between the other thumb and index finger']],
  },
  Z: {
    hands: 2,
    how: 'Hold one hand flat and upright. Point your other index finger sideways into its palm.',
    tip: 'A finger pointing into a flat hand.',
    hints: [['a_index_bPalm', 'hi', 'Touch your index fingertip to the flat palm'], ['b_indexCurl', 'hi', 'Hold the flat hand straight']],
  },
};

export const ISL_ALPHABET = Object.keys(ISL_LETTERS);
