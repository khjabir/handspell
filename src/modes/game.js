// Letter rain: letters fall down the camera picture; sign the lowest one before it lands.
// Without a camera you can type the letters instead.
import { ALPHABET } from '../sign/letters.js';
import { Hold, feedback } from './common.js';

const $ = (id) => document.getElementById(id);

export class GameMode {
  constructor(app) {
    this.app = app;
    this.hold = new Hold();
    this.s = null;
    $('gameStart').addEventListener('click', () => (this.s && this.s.playing ? this.stop() : this.start()));
    document.addEventListener('keydown', (e) => {
      if (app.modeName !== 'game' || !this.s || !this.s.playing || app.camera.on) return;
      if (/^[a-z]$/i.test(e.key)) this.#tryKey(e.key.toUpperCase());
    });
  }

  stages() { return []; }
  target() { return this.s && this.s.playing && this.#lowest() ? this.#lowest().letter : null; }
  get showGuess() { return true; }

  enter() { this.#paint(); }
  exit() { if (this.s && this.s.playing) this.stop(); }
  cameraChanged() {}

  start() {
    const app = this.app;
    app.sound.unlock();
    // Letters held still (in ASL, J and Z are drawn in the air, too slow for falling letters)
    const still = ALPHABET.filter((l) => !app.sign.moving.has(l));
    let pool = still;
    if ($('gameEasy').checked) {
      const learned = still.filter((l) => app.store.progress.learned[l]);
      if (learned.length >= 3) pool = learned;
      else app.toast('Learn at least three letters first. Playing with all of them for now.');
    }
    this.s = { playing: true, pool, drops: [], pops: [], score: 0, lives: 3, speed: 0.07, spawnAt: app.t + 1, every: 2.4, flash: 0 };
    this.hold.reset();
    $('gameStart').textContent = 'Stop';
    feedback($('gameFeedback'), app.camera.on ? 'Sign the lowest letter.' : 'No camera on, so type the letters instead.');
    this.#paint();
  }

  stop(over = false) {
    const s = this.s;
    if (!s) return;
    s.playing = false;
    $('gameStart').textContent = 'Play again';
    const p = this.app.store.progress;
    const best = s.score > p.gameBest;
    if (best) p.gameBest = s.score;
    if (s.score) this.app.store.practised();
    this.app.store.save();
    if (over) {
      this.app.sound.miss();
      feedback($('gameFeedback'), `Game over. You caught ${s.score} letter${s.score === 1 ? '' : 's'}.`, best && s.score ? 'ok' : '', best && s.score ? 'A new best!' : '');
    }
    this.#paint();
  }

  #lowest() {
    const d = this.s.drops.filter((x) => !x.gone);
    return d.sort((a, b) => b.y - a.y)[0] || null;
  }

  frame(t, dt) {
    const s = this.s;
    if (!s || !s.playing) return;
    // New letters
    if (t >= s.spawnAt) {
      const recent = s.drops.slice(-2).map((d) => d.letter);
      let l;
      do { l = s.pool[Math.floor(Math.random() * s.pool.length)]; } while (recent.includes(l) && s.pool.length > 3);
      s.drops.push({ letter: l, x: 0.12 + Math.random() * 0.76, y: -0.08, born: t });
      s.spawnAt = t + s.every;
    }
    for (const d of s.drops) d.y += s.speed * dt;
    // Landed?
    for (const d of s.drops) {
      if (!d.gone && d.y >= 0.92) {
        d.gone = true;
        s.lives--;
        s.flash = t + 0.35;
        this.app.sound.miss();
        this.#paint();
        if (s.lives <= 0) { this.stop(true); return; }
      }
    }
    // Signing the lowest letter
    const low = this.#lowest();
    if (low && this.app.camera.on) {
      const ok = this.app.live.accepts(low.letter, t);
      if (this.hold.update(ok, dt, this.app.holdTime * 0.6) >= 1) this.#catch(low, t);
    }
    s.drops = s.drops.filter((d) => !d.gone || t - (d.goneAt || t) < 0.5);
    s.pops = s.pops.filter((p) => t - p.t < 0.6);
  }

  #tryKey(letter) {
    const low = this.#lowest();
    if (low && low.letter === letter) this.#catch(low, this.app.t);
    else this.app.sound.tick();
  }

  #catch(d, t) {
    const s = this.s;
    d.gone = true;
    d.goneAt = t;
    s.pops.push({ x: d.x, y: d.y, t, letter: d.letter });
    s.score++;
    s.speed = Math.min(0.3, s.speed * 1.06);
    s.every = Math.max(0.9, s.every * 0.96);
    this.hold.reset();
    this.app.sound.pop();
    this.#paint();
  }

  drawOverlay(ctx, t) {
    const s = this.s;
    const { W, H } = this.app.cover;
    if (!s) return;
    if (s.flash > t) {
      ctx.fillStyle = `rgba(255, 72, 176, ${((s.flash - t) / 0.35) * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }
    // ground line
    ctx.fillStyle = 'rgba(243, 244, 248, 0.5)';
    ctx.fillRect(0, H * 0.94, W, 3);
    const low = s.playing ? this.#lowest() : null;
    const size = Math.max(44, Math.min(W, H) * 0.11);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${size}px 'Bricolage Grotesque', 'Arial Black', sans-serif`;
    for (const d of s.drops) {
      if (d.gone) continue;
      const x = d.x * W, y = d.y * H;
      const isLow = d === low;
      const r = size * 0.62;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = isLow ? '#F3F4F8' : 'rgba(243, 244, 248, 0.6)';
      ctx.fill();
      if (isLow) {
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#FF48B0';
        ctx.stroke();
        if (this.hold.v > 0) {
          ctx.beginPath();
          ctx.arc(x, y, r + 9, -Math.PI / 2, -Math.PI / 2 + this.hold.v * Math.PI * 2);
          ctx.strokeStyle = '#00A05A';
          ctx.lineWidth = 6;
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#FF48B0';
      ctx.fillText(d.letter, x + size * 0.045, y + size * 0.04);
      ctx.fillStyle = '#24257A';
      ctx.fillText(d.letter, x, y);
    }
    for (const p of s.pops) {
      const k = (t - p.t) / 0.6;
      const x = p.x * W, y = p.y * H;
      ctx.strokeStyle = `rgba(0, 160, 90, ${1 - k})`;
      ctx.lineWidth = 4;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r1 = size * (0.5 + k * 0.8), r2 = size * (0.7 + k * 1.1);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
        ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
        ctx.stroke();
      }
    }
  }

  #paint() {
    const s = this.s;
    const p = this.app.store.progress;
    const hearts = s ? '●'.repeat(Math.max(0, s.lives)) + '○'.repeat(Math.max(0, 3 - s.lives)) : '●●●';
    $('gameStats').innerHTML = `
      <div><dt>Caught</dt><dd>${s ? s.score : 0}</dd></div>
      <div><dt>Lives</dt><dd aria-label="${s ? s.lives : 3} lives">${hearts}</dd></div>
      <div><dt>Best</dt><dd>${p.gameBest}</dd></div>`;
  }
}
