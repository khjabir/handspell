// The reference hand: shows a letter, eases from one letter to the next, can be turned by
// dragging, and fingerspells whole words (with the J and Z movements, and a small bounce
// for double letters). For ISL it draws both hands, and a face for I.
import { POSES } from './poses.js';
import { ISL_POSES, ISL_EXTENT } from './isl-poses.js';
import { drawHand, orient, blend, soften, SKIN } from './render.js';
import { PATHS } from '../sign/motion.js';

const ZERO_VIEW = { roll: 0, yaw: 0, pitch: 0 };

/** Letters drawn with a small movement in ISL, and how the moving hand travels. */
const ISL_MOVES = { H: 'brush', J: 'trace' };

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpView = (a, b, t) => ({ roll: lerp(a.roll, b.roll, t), yaw: lerp(a.yaw, b.yaw, t), pitch: lerp(a.pitch, b.pitch, t) });

export class HandStage {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts { mirror: boolean, skin: string, accent: string, ink: string, reduceMotion: boolean }
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = { mirror: true, skin: 'medium', accent: '#FF4FA3', ink: '#23246B', reduceMotion: false, alphabet: 'asl', ...opts };
    this.letter = 'A';
    this.from = this.#pose('A');
    this.to = this.from;
    this.t0 = 0;
    this.dur = 0.001;
    this.turn = { yaw: 0, pitch: 0 }; // user's drag
    this.offset = { x: 0, y: 0 }; // movement (J, Z, bounces), in hand heights
    this.path = null; // movement guide to draw
    this.pathProgress = 0;
    this.queue = null;
    this.running = false;
    this.#bindDrag();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  set(o) {
    const changed = o.alphabet && o.alphabet !== this.opts.alphabet;
    Object.assign(this.opts, o);
    if (changed) {
      // A new alphabet: jump straight to its pose (the point sets differ)
      this.stop();
      this.from = this.to = this.#pose(this.letter);
      this.path = null;
    }
  }

  get isl() { return this.opts.alphabet === 'isl'; }

  /** The pose for a letter: points, view, and (ISL) how visible each hand is. */
  #pose(letter, current) {
    if (!this.isl) return { pts: POSES[letter].pts, view: POSES[letter].view, alpha: [1, 1] };
    const p = ISL_POSES[letter];
    // A one-hand letter lets the other hand drop away and fade out
    const b = p.b || (current && current.pts.length === 42 ? current.pts.slice(21) : ISL_POSES.A.b).map(([x, y, z]) => [x, y - 1.2, z]);
    const bl = p.b ? p.bl : current && current.left ? current.left[1] : true;
    return { pts: [...p.a, ...b], view: ZERO_VIEW, alpha: [1, p.b ? 1 : 0], size: { w: p.w, h: p.h }, left: [p.al, bl] };
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  #current(now) {
    const t = Math.min(1, (now - this.t0) / this.dur);
    const k = ease(t);
    if (this.from.pts.length !== this.to.pts.length) return this.to;
    const size = this.from.size && this.to.size ? { w: lerp(this.from.size.w, this.to.size.w, k), h: lerp(this.from.size.h, this.to.size.h, k) } : this.to.size;
    return {
      pts: blend(this.from.pts, this.to.pts, k),
      view: lerpView(this.from.view, this.to.view, k),
      alpha: [0, 1].map((i) => lerp(this.from.alpha[i], this.to.alpha[i], k)),
      size,
      left: k < 0.5 ? this.from.left : this.to.left,
    };
  }

  /** Show a letter, easing from the current pose. */
  show(letter, dur = 0.35) {
    const now = performance.now() / 1000;
    const cur = this.#current(now);
    this.letter = letter;
    this.from = cur;
    this.to = this.#pose(letter, cur);
    this.t0 = now;
    this.dur = this.opts.reduceMotion ? 0.001 : dur;
    this.path = !this.isl && PATHS[letter] ? letter : null;
    this.pathProgress = 0;
    this.offset = { x: 0, y: 0 };
  }

  /** Reset the user's turning. */
  straighten() { this.turn = { yaw: 0, pitch: 0 }; }

  /**
   * Fingerspell a word. Resolves when done, or early if stopped.
   * @param {string} word
   * @param {number} lettersPerSecond
   * @param {(i:number) => void} [onLetter]
   */
  spell(word, lettersPerSecond = 1.5, onLetter) {
    this.stop();
    const letters = word.toUpperCase().replace(/[^A-Z]/g, '').split('');
    const per = 1 / lettersPerSecond;
    const steps = [];
    let at = 0.25;
    const moves = (l) => (this.isl ? !!ISL_MOVES[l] : !!PATHS[l]);
    letters.forEach((l, i) => {
      const double = i > 0 && letters[i - 1] === l;
      steps.push({ at, letter: l, i, double, move: moves(l) ? l : null, dur: moves(l) ? per * 1.4 : per });
      at += moves(l) ? per * 1.4 : per;
    });
    return new Promise((resolve) => {
      this.queue = { steps, start: performance.now() / 1000, next: 0, end: at + 0.3, resolve, onLetter, per };
    });
  }

  stop() {
    if (this.queue) { const q = this.queue; this.queue = null; q.resolve(false); }
    this.offset = { x: 0, y: 0 };
  }

  get spelling() { return !!this.queue; }

  #runQueue(now) {
    const q = this.queue;
    if (!q) return;
    const t = now - q.start;
    while (q.next < q.steps.length && t >= q.steps[q.next].at) {
      const step = q.steps[q.next];
      this.show(step.letter, Math.min(0.22, q.per * 0.35));
      this.path = null;
      step.started = now;
      q.current = step;
      if (q.onLetter) q.onLetter(step.i);
      q.next++;
    }
    const cur = q.current;
    this.offset = { x: 0, y: 0 };
    if (cur && !this.opts.reduceMotion) {
      const u = Math.min(1, (now - cur.started) / cur.dur);
      if (cur.double) {
        // A double letter slides a little to the side
        this.offset.x = 0.22 * Math.sin(Math.min(1, u * 1.6) * Math.PI / 2);
      }
      if (cur.move && this.isl) {
        // ISL H and J: the moving hand travels a little and back (see #draw)
        this.moveAt = u;
      } else if (cur.move) {
        // J and Z: the hand travels along the letter's path while holding the shape
        const pts = PATHS[cur.move];
        const k = Math.min(1, Math.max(0, (u - 0.15) / 0.75)) * (pts.length - 1);
        const a = Math.floor(k), b = Math.min(pts.length - 1, a + 1), f = k - a;
        const x = lerp(pts[a][0], pts[b][0], f), y = lerp(pts[a][1], pts[b][1], f);
        this.offset = { x: (x - 0.3) * 0.7, y: (y - 0.35) * 0.55 };
      }
    }
    if (t >= q.end) {
      this.queue = null;
      this.offset = { x: 0, y: 0 };
      q.resolve(true);
    }
  }

  draw(now = performance.now() / 1000) {
    this.moveAt = null;
    this.#runQueue(now);
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const pose = this.#current(now);
    if (this.isl) { this.#drawIsl(pose, now); return; }
    const sway = this.opts.reduceMotion || this.queue ? 0 : Math.sin(now * 1.3) * 4;
    const view = { roll: pose.view.roll, yaw: pose.view.yaw + this.turn.yaw + sway, pitch: pose.view.pitch + this.turn.pitch };
    const pts = orient(pose.pts, view);
    const scale = Math.min(w / 3.3, h / 3.1);
    const mirror = this.opts.mirror;
    const flip = mirror ? -1 : 1;
    const cx = w / 2 + flip * this.offset.x * scale, cy = h * 0.52 + this.offset.y * scale;

    // Movement guide for J and Z, drawn behind the hand and traced as it animates
    if (this.path && !this.queue) {
      this.#drawPath(PATHS[this.path], cx, cy, scale, flip, now);
    }
    const skin = { ...(SKIN[this.opts.skin] || SKIN.medium), line: this.opts.ink };
    drawHand(ctx, pts, { x: cx, y: cy, scale, mirror, skin });
  }

  /** Both hands in one frame (palm lengths, x right, y up), plus a face for I. */
  #drawIsl(pose, now) {
    const { ctx, w, h } = this;
    const sway = this.opts.reduceMotion || this.queue ? 0 : Math.sin(now * 1.3) * 4;
    let pts = orient(pose.pts, { roll: 0, yaw: this.turn.yaw + sway, pitch: this.turn.pitch });
    // The poses are stored as a mirror shows them, so "like a mirror" needs no flip
    const flip = this.opts.mirror ? 1 : -1;

    // I points at the face: a head goes beside the fingertip, and the picture is framed around both
    let size = pose.size || ISL_EXTENT, centre = [0, 0], head = null;
    if (this.letter === 'I' && pose.alpha[1] < 0.5) {
      const tip = pose.pts[8];
      const hw = 0.78, hh = 1.0;
      const eye = [tip[0] + 0.04, tip[1] + 0.3];
      head = { c: [eye[0] - 0.42 * hw, eye[1] - 0.16 * hh], hw, hh, eye };
      const hand = pose.pts.slice(0, 21);
      const xs = [...hand.map((p) => p[0]), head.c[0] - hw, head.c[0] + hw];
      const ys = [...hand.map((p) => p[1]), head.c[1] - hh - 0.35, head.c[1] + hh];
      size = { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      centre = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2];
    }
    // Fit the picture to the box, within limits: one-hand letters don't balloon, and no letter
    // is drawn smaller than the largest pose needs
    const most = Math.min(w / 2.8, h / 2.4);
    const least = Math.min(w / (ISL_EXTENT.w + 0.4), h / (ISL_EXTENT.h + 0.4));
    const fit = Math.min(w / (size.w + 0.8), h / (size.h + 0.8));
    const scale = Math.max(head ? 0 : least, Math.min(most, fit));
    const cx = w / 2 + flip * (this.offset.x - centre[0]) * scale, cy = h * 0.5 + (this.offset.y + centre[1]) * scale;

    // H and J: the moving hand brushes or traces a short way and back
    const move = ISL_MOVES[this.letter];
    if (move && !this.opts.reduceMotion) {
      const u = this.moveAt !== null ? this.moveAt : ((now * 0.7) % 1);
      const k = Math.sin(u * Math.PI) * 0.35;
      const a = pts.slice(0, 21), b = pts.slice(21);
      const from = move === 'brush' ? a[0] : b[5], to = move === 'brush' ? a[12] : b[8];
      const d = [to[0] - from[0], to[1] - from[1]];
      const L = Math.hypot(d[0], d[1]) || 1;
      pts = [...a.map(([x, y, z]) => [x + (d[0] / L) * k, y + (d[1] / L) * k, z]), ...b];
    }
    const skin = { ...(SKIN[this.opts.skin] || SKIN.medium), line: this.opts.ink };
    const project = ([x, y]) => [cx + flip * x * scale, cy - y * scale];
    if (head) this.#drawFace(head, project, scale, skin, project(pts[8]));
    const common = { x: cx, y: cy, scale, mirror: flip < 0, center: [0, 0] };
    const left = pose.left || [false, true];
    // The hand behind is paler, so the two hands read apart where they overlap
    if (pose.alpha[1] > 0.05) drawHand(ctx, pts.slice(21), { ...common, skin: soften(skin), left: left[1], alpha: pose.alpha[1] ** 2 });
    drawHand(ctx, pts.slice(0, 21), { ...common, skin, left: left[0], alpha: pose.alpha[0] });
  }

  /** A simple face (in palm lengths, projected to the canvas), with a ring where the finger touches. */
  #drawFace(head, project, scale, skin, tipPx) {
    const { ctx } = this;
    const [cx, cy] = project(head.c);
    const hw = head.hw * scale, hh = head.hh * scale;
    const eyeY = project(head.eye)[1];
    ctx.save();
    ctx.lineWidth = Math.max(1.5, scale * 0.028);
    ctx.strokeStyle = skin.line;
    // neck
    ctx.fillStyle = skin.shade;
    ctx.beginPath();
    ctx.rect(cx - hw * 0.36, cy + hh * 0.72, hw * 0.72, scale * 0.35 + hh * 0.28);
    ctx.fill();
    ctx.stroke();
    // head
    ctx.fillStyle = skin.fill;
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // hair: the top of the head, down to a soft fringe
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hh, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = skin.line;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 1.1, cy - hh * 1.1);
    ctx.lineTo(cx + hw * 1.1, cy - hh * 1.1);
    ctx.lineTo(cx + hw * 1.1, cy - hh * 0.3);
    ctx.quadraticCurveTo(cx + hw * 0.4, cy - hh * 0.62, cx - hw * 0.1, cy - hh * 0.5);
    ctx.quadraticCurveTo(cx - hw * 0.6, cy - hh * 0.42, cx - hw * 1.1, cy - hh * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // eyes, nose, mouth
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + sx * hw * 0.42, eyeY, hw * 0.1, hh * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(cx, eyeY + hh * 0.1);
    ctx.lineTo(cx - hw * 0.07, eyeY + hh * 0.38);
    ctx.lineTo(cx + hw * 0.05, eyeY + hh * 0.4);
    ctx.moveTo(cx - hw * 0.25, cy + hh * 0.48);
    ctx.quadraticCurveTo(cx, cy + hh * 0.58, cx + hw * 0.25, cy + hh * 0.48);
    ctx.stroke();
    // a ring on the cheek where the finger touches
    ctx.strokeStyle = this.opts.accent;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(2, scale * 0.04);
    ctx.beginPath();
    ctx.arc(tipPx[0], tipPx[1], scale * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  #drawPath(path, cx, cy, scale, flip, now) {
    const { ctx } = this;
    const box = scale * 1.2;
    const ox = cx - flip * box * 0.35, oy = cy - box * 0.45;
    const P = path.map(([x, y]) => [ox + flip * x * box, oy + y * box]);
    const cyc = this.opts.reduceMotion ? 1 : ((now * 0.5) % 1.3) / 1.0;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.opts.accent;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = Math.max(4, scale * 0.06);
    ctx.setLineDash([2, scale * 0.09]);
    ctx.beginPath();
    P.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    // traced part
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    const total = P.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - P[i][0], p[1] - P[i][1]), 0);
    let left = total * Math.min(1, cyc);
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    let end = P[0], dir = [1, 0];
    for (let i = 1; i < P.length && left > 0; i++) {
      const seg = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      const f = Math.min(1, left / seg);
      end = [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f];
      dir = [(P[i][0] - P[i - 1][0]) / seg, (P[i][1] - P[i - 1][1]) / seg];
      ctx.lineTo(end[0], end[1]);
      left -= seg;
    }
    ctx.stroke();
    // arrow head
    const a = Math.max(10, scale * 0.11);
    ctx.fillStyle = this.opts.accent;
    ctx.beginPath();
    ctx.moveTo(end[0] + dir[0] * a * 0.6, end[1] + dir[1] * a * 0.6);
    ctx.lineTo(end[0] - dir[0] * a * 0.5 - dir[1] * a * 0.55, end[1] - dir[1] * a * 0.5 + dir[0] * a * 0.55);
    ctx.lineTo(end[0] - dir[0] * a * 0.5 + dir[1] * a * 0.55, end[1] - dir[1] * a * 0.5 - dir[0] * a * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  #bindDrag() {
    const c = this.canvas;
    let drag = null;
    c.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, yaw: this.turn.yaw, pitch: this.turn.pitch };
      c.setPointerCapture(e.pointerId);
      c.classList.add('dragging');
    });
    c.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const flip = this.opts.mirror ? -1 : 1;
      this.turn.yaw = Math.max(-80, Math.min(80, drag.yaw + flip * (e.clientX - drag.x) * 0.5));
      this.turn.pitch = Math.max(-60, Math.min(60, drag.pitch + (e.clientY - drag.y) * 0.4));
    });
    const end = () => { drag = null; c.classList.remove('dragging'); };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('dblclick', () => this.straighten());
    // Keyboard turning for people who don't use a pointer
    c.addEventListener('keydown', (e) => {
      const step = 12;
      if (e.key === 'ArrowLeft') this.turn.yaw -= step;
      else if (e.key === 'ArrowRight') this.turn.yaw += step;
      else if (e.key === 'ArrowUp') this.turn.pitch -= step;
      else if (e.key === 'ArrowDown') this.turn.pitch += step;
      else if (e.key === 'Home' || e.key === '0') this.straighten();
      else return;
      e.preventDefault();
    });
  }
}
