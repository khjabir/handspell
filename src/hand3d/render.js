// Draws a hand from 21 points in the hand's own frame: x towards the thumb side, y up the
// hand (palm lengths), z out of the palm. The bones become rounded, outlined strokes, the
// palm a filled shape, and everything is sorted by depth so near parts cover far ones.

const FINGERS = [
  { name: 'thumb', idx: [1, 2, 3, 4], width: [0.27, 0.24, 0.215] },
  { name: 'index', idx: [5, 6, 7, 8], width: [0.205, 0.19, 0.175] },
  { name: 'middle', idx: [9, 10, 11, 12], width: [0.21, 0.195, 0.18] },
  { name: 'ring', idx: [13, 14, 15, 16], width: [0.2, 0.185, 0.17] },
  { name: 'pinky', idx: [17, 18, 19, 20], width: [0.175, 0.16, 0.15] },
];
const PALM = [0, 1, 2, 5, 9, 13, 17];

export const SKIN = {
  light: { fill: '#F6D5BE', shade: '#E7B898', line: '#6B4231', nail: '#FBE7DA' },
  medium: { fill: '#D9A27C', shade: '#C38660', line: '#5A3322', nail: '#EDC6AD' },
  tan: { fill: '#B47A52', shade: '#9B6440', line: '#47261A', nail: '#D8A888' },
  deep: { fill: '#7C4B32', shade: '#683D27', line: '#2E1810', nail: '#A97A60' },
  glove: { fill: '#FFFFFF', shade: '#E4E7F2', line: '#1E2240', nail: '#F1F3FA' },
};

const DEG = Math.PI / 180;

/** Rotate points: roll in the picture plane (towards the thumb side), then yaw about the
 *  vertical axis, then pitch about the horizontal axis. Angles in degrees. */
export function orient(pts, { roll = 0, yaw = 0, pitch = 0 } = {}) {
  const cr = Math.cos(roll * DEG), sr = Math.sin(roll * DEG);
  const cy = Math.cos(yaw * DEG), sy = Math.sin(yaw * DEG);
  const cp = Math.cos(pitch * DEG), sp = Math.sin(pitch * DEG);
  return pts.map(([x, y, z]) => {
    // roll: positive tips the fingers towards +x
    let X = x * cr + y * sr, Y = -x * sr + y * cr, Z = z;
    // yaw: positive turns the palm towards +x
    const X2 = X * cy + Z * sy, Z2 = -X * sy + Z * cy;
    X = X2; Z = Z2;
    // pitch: positive tips the top of the hand towards the viewer
    const Y2 = Y * cp - Z * sp, Z3 = Y * sp + Z * cp;
    return [X, Y2, Z3];
  });
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[][]} pts 21 points (already oriented), z towards the viewer
 * @param {object} o
 * @param {number} o.x centre x on the canvas
 * @param {number} o.y centre y
 * @param {number} o.scale pixels per palm length
 * @param {boolean} [o.mirror] draw mirrored (as in a mirror or a selfie camera)
 * @param {object} [o.skin] colours from SKIN
 * @param {Set<string>|null} [o.highlight] finger names to highlight
 * @param {string} [o.accent] highlight colour
 * @param {number} [o.alpha]
 * @param {number[]} [o.center] [x, y] of the points to put at (o.x, o.y); defaults to the middle of
 *   the hand. Two hands drawn with the same centre keep their places relative to each other.
 * @param {boolean} [o.left] the points are a left hand (seen from the same side as a right hand
 *   would be), which turns the palm the other way
 */
export function drawHand(ctx, pts, o) {
  const skin = o.skin || SKIN.medium;
  const s = o.scale;
  const flip = o.mirror ? -1 : 1;
  // Centre the drawing on the hand's bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const cx = o.center ? o.center[0] : (minX + maxX) / 2, cy = o.center ? o.center[1] : (minY + maxY) / 2;
  const P = pts.map(([x, y, z]) => [o.x + flip * (x - cx) * s, o.y - (y - cy) * s, z]);

  // Depth range for shading
  let zMin = Infinity, zMax = -Infinity;
  for (const p of pts) { zMin = Math.min(zMin, p[2]); zMax = Math.max(zMax, p[2]); }
  const zr = Math.max(0.3, zMax - zMin);

  // The palm gets a proper wrist (MediaPipe's wrist point is in the middle of it) and a
  // short stub of forearm so the hand reads as attached to an arm.
  const across = sub(pts[5], pts[17]);
  const upv = sub(pts[9], pts[0]);
  const at = (base, a, ka, b, kb) => [base[0] + a[0] * ka + b[0] * kb, base[1] + a[1] * ka + b[1] * kb, base[2] + a[2] * ka + b[2] * kb];
  const wristThumb = at(pts[0], across, 0.32, upv, 0.02);
  const wristPinky = at(pts[0], across, -0.42, upv, 0.06);
  const toScreen = ([x, y, z]) => [o.x + flip * (x - cx) * s, o.y - (y - cy) * s, z];
  const palmPoly = [wristThumb, pts[1], pts[2], pts[5], pts[9], pts[13], pts[17], wristPinky].map(toScreen);
  // The forearm is a round limb: the same width from any angle.
  const armA = toScreen(at(pts[0], across, -0.05, upv, 0.05));
  const armB = toScreen(at(pts[0], across, -0.05, upv, -0.6));

  const parts = [];
  const palmZ = PALM.reduce((a, i) => a + pts[i][2], 0) / PALM.length;
  parts.push({ kind: 'arm', z: palmZ - 0.6 });
  parts.push({ kind: 'palm', z: palmZ - 0.02 });
  for (const f of FINGERS) {
    // Fingers are drawn whole, sorted by their middle joint's depth. A finger curled in front
    // of the palm comes after it; one behind comes before.
    const zf = (pts[f.idx[1]][2] + pts[f.idx[2]][2] + pts[f.idx[3]][2]) / 3;
    parts.push({ kind: 'finger', f, z: zf });
  }
  parts.sort((p, q) => p.z - q.z);

  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const outline = Math.max(1.5, s * 0.028);
  const shadeFor = (z) => {
    const t = (z - zMin) / zr; // 0 far .. 1 near
    return mix(skin.shade, skin.fill, 0.35 + 0.65 * t);
  };
  const poly = (list) => {
    ctx.beginPath();
    list.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  };

  for (const part of parts) {
    if (part.kind === 'arm') {
      ctx.save();
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(armA[0], armA[1]);
      ctx.lineTo(armB[0], armB[1]);
      ctx.strokeStyle = skin.line;
      ctx.lineWidth = s * 0.6 + outline * 2;
      ctx.stroke();
      ctx.strokeStyle = skin.shade;
      ctx.lineWidth = s * 0.6;
      ctx.stroke();
      ctx.restore();
      continue;
    }
    if (part.kind === 'palm') {
      const round = s * 0.16;
      poly(palmPoly);
      ctx.lineWidth = round + outline * 2;
      ctx.strokeStyle = skin.line;
      ctx.stroke();
      ctx.fillStyle = shadeFor(part.z);
      ctx.lineWidth = round;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.fill();
      ctx.stroke();
      continue;
    }
    const f = part.f;
    const hl = o.highlight && o.highlight.has(f.name);
    const chain = f.idx.map((i) => P[i]);
    // Outline pass for the whole finger, then the fill bone by bone (tapering), so there are
    // no seams at the joints.
    ctx.beginPath();
    chain.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.strokeStyle = hl ? o.accent || '#E8590C' : skin.line;
    ctx.lineWidth = f.width[0] * s + outline * 2 + (hl ? outline * 1.6 : 0);
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      const A = chain[k], B = chain[k + 1];
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(B[0], B[1]);
      ctx.strokeStyle = shadeFor((pts[f.idx[k]][2] + pts[f.idx[k + 1]][2]) / 2);
      ctx.lineWidth = f.width[k] * s;
      ctx.stroke();
    }
    // A nail on the fingertip when the back of the hand faces the viewer
    const back = (o.left ? 1 : -1) * palmNormal(pts)[2];
    if (back > 0.25) {
      const A = chain[2], B = chain[3];
      const w = f.width[2] * s;
      const dx = B[0] - A[0], dy = B[1] - A[1];
      const L = Math.hypot(dx, dy) || 1;
      if (L > w * 0.5) {
        const ux = dx / L, uy = dy / L;
        ctx.save();
        ctx.translate(B[0] - ux * w * 0.3, B[1] - uy * w * 0.3);
        ctx.rotate(Math.atan2(uy, ux));
        ctx.globalAlpha *= Math.min(1, (back - 0.25) * 3);
        ctx.fillStyle = skin.nail;
        ctx.strokeStyle = mix(skin.line, skin.fill, 0.55);
        ctx.lineWidth = Math.max(1, outline * 0.6);
        roundRect(ctx, -w * 0.34, -w * 0.3, w * 0.52, w * 0.6, w * 0.22);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  ctx.restore();
  return P;
}

export function palmNormal(pts) {
  const u = sub(pts[9], pts[0]), v = sub(pts[5], pts[17]);
  const c = [v[1] * u[2] - v[2] * u[1], v[2] * u[0] - v[0] * u[2], v[0] * u[1] - v[1] * u[0]];
  const l = Math.hypot(...c) || 1;
  // In this frame (x thumb side, y up, z out of the palm) v × u points out of the palm
  return [c[0] / l, c[1] / l, c[2] / l];
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mix(a, b, t) {
  const rgb = (c) => {
    if (c.startsWith('#')) { const p = parseInt(c.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; }
    return c.match(/\d+/g).slice(0, 3).map(Number);
  };
  const pa = rgb(a), pb = rgb(b);
  const c = [0, 1, 2].map((i) => Math.round(pa[i] + (pb[i] - pa[i]) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/**
 * A paler version of a skin, for the hand behind in two-hand letters, so the two hands read
 * apart where they overlap.
 */
export function soften(skin, paper = '#F3F4F8', k = 0.45) {
  return {
    fill: mix(skin.fill, paper, k),
    shade: mix(skin.shade, paper, k),
    line: mix(skin.line, paper, k * 0.75),
    nail: mix(skin.nail, paper, k),
  };
}

/** Linear blend between two point sets (for animating from one letter to the next). */
export function blend(a, b, t) {
  return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t, p[2] + (b[i][2] - p[2]) * t]);
}
