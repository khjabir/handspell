// J and Z are drawn in the air. This follows a fingertip (the little finger for J, the index
// for Z) while the hand holds the starting shape, and recognises the path.
// Positions are on the mirrored screen, measured in palm lengths, so the size of the hand
// and its distance from the camera don't matter. Both drawing directions are accepted, so
// left-handed signers work too.

const WINDOW = 1.8; // seconds of history

/** Ramer-Douglas-Peucker simplification of a polyline. */
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let best = -1, bestD = 0;
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1e-6;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i].x - dx * pts[i].y + b.x * a.y - b.y * a.x) / L;
    if (d > bestD) { bestD = d; best = i; }
  }
  if (bestD <= eps) return [a, b];
  return [...simplify(pts.slice(0, best + 1), eps).slice(0, -1), ...simplify(pts.slice(best), eps)];
}

const pathLength = (pts) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

export class MotionTracker {
  constructor() {
    this.trails = { J: [], Z: [] };
    this.last = { J: -10, Z: -10 };
  }

  reset() { this.trails = { J: [], Z: [] }; }

  /**
   * @param {number} t seconds
   * @param {{x:number,y:number}} pinky little fingertip on screen, in pixels
   * @param {{x:number,y:number}} index index fingertip on screen, in pixels
   * @param {number} palm palm length in pixels
   * @param {{J:boolean, Z:boolean}} shape whether the hand holds each letter's starting shape
   * @returns {'J'|'Z'|null} a letter, the moment its movement is completed
   */
  push(t, pinky, index, palm, shape) {
    const out = [];
    for (const [letter, tip] of [['J', pinky], ['Z', index]]) {
      const trail = this.trails[letter];
      if (shape[letter]) trail.push({ t, x: tip.x / palm, y: tip.y / palm });
      else if (trail.length && t - trail[trail.length - 1].t > 0.25) trail.length = 0; // shape lost for a while
      while (trail.length && t - trail[0].t > WINDOW) trail.shift();
      if (t - this.last[letter] < 1 || trail.length < 6) continue;
      const hit = letter === 'J' ? isJ(trail) : isZ(trail);
      if (hit) {
        this.last[letter] = t;
        trail.length = 0;
        out.push(letter);
      }
    }
    return out[0] || null;
  }

  /** Recent path of a fingertip (for drawing), in palm units. */
  trail(letter) { return this.trails[letter]; }
}

/** J: the little finger drops, then sweeps sideways as the hook of the J curves round. */
export function isJ(trail) {
  const pts = trail;
  if (pathLength(pts) < 0.55) return false;
  let lo = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].y > pts[lo].y) lo = i;
  const start = pts[0], bottom = pts[lo], end = pts[pts.length - 1];
  const down = bottom.y - start.y;
  if (down < 0.3) return false;
  // Where the hand is halfway down: the first half of the drop should be fairly straight
  const half = pts.find((p) => p.y - start.y >= down * 0.5) || bottom;
  const side = end.x - start.x;
  const early = Math.abs(half.x - start.x);
  const late = Math.abs(end.x - half.x);
  return Math.abs(side) > 0.22 && early < down * 0.45 && late > Math.abs(side) * 0.6 && Math.sign(end.x - half.x) === Math.sign(side);
}

/** Z: across, diagonally back and down, then across again in the first direction. */
export function isZ(trail) {
  if (pathLength(trail) < 1.1) return false;
  const simple = simplify(trail, 0.12);
  const segs = [];
  for (let i = 1; i < simple.length; i++) {
    const dx = simple[i].x - simple[i - 1].x, dy = simple[i].y - simple[i - 1].y;
    if (Math.hypot(dx, dy) > 0.2) segs.push({ dx, dy });
  }
  for (let i = 0; i + 2 < segs.length; i++) {
    const [a, b, c] = [segs[i], segs[i + 1], segs[i + 2]];
    const flatA = Math.abs(a.dx) > 0.3 && Math.abs(a.dy) < Math.abs(a.dx) * 0.6;
    const flatC = Math.abs(c.dx) > 0.3 && Math.abs(c.dy) < Math.abs(c.dx) * 0.6;
    const same = Math.sign(a.dx) === Math.sign(c.dx);
    const diag = Math.sign(b.dx) === -Math.sign(a.dx) && b.dy > 0.2 && Math.abs(b.dx) > 0.15;
    if (flatA && flatC && same && diag) return true;
  }
  return false;
}

/** The movement shapes, for drawing guides and animating the reference hand (unit box, y down). */
export const PATHS = {
  // little fingertip: down, then hook towards the thumb side and up
  J: [[0, 0], [0, 0.35], [0.02, 0.62], [0.12, 0.8], [0.28, 0.86], [0.42, 0.78]],
  // index fingertip: across, diagonal back and down, across
  Z: [[0, 0], [0.7, 0], [0, 0.7], [0.7, 0.7]],
};
