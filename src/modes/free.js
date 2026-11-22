// Free spell: sign anything and it is written down. A letter is added once it has been
// held steadily; the same letter again needs a small slide or a release first; lowering the
// hand out of view adds a space.
import { Hold, setBar } from './common.js';

const $ = (id) => document.getElementById(id);

export class FreeMode {
  constructor(app) {
    this.app = app;
    this.text = '';
    this.hold = new Hold();
    this.candidate = null;
    this.last = null; // { letter, x, y } of the last letter added, until released
    this.goneSince = 0;
    $('freeSpace').addEventListener('click', () => this.#add(' '));
    $('freeBack').addEventListener('click', () => { this.text = this.text.slice(0, -1); this.#paint(); });
    $('freeClear').addEventListener('click', () => { this.text = ''; this.#paint(); });
    $('freeSpeak').addEventListener('click', () => {
      if (!this.text.trim()) { app.toast('Sign something first.'); return; }
      app.say(this.text.toLowerCase());
    });
  }

  stages() { return []; }
  target() { return this.candidate; }
  enter() { this.#paint(); }
  exit() {}
  cameraChanged() { this.hold.reset(); }

  frame(t, dt, state) {
    if (!this.app.camera.on) return;
    if (!state || t - state.t > 0.3) {
      // Hand lowered: after a moment, a space (once)
      if (!this.goneSince) this.goneSince = t;
      if (t - this.goneSince > 1.2 && this.text && !this.text.endsWith(' ')) this.#add(' ');
      this.last = null;
      this.hold.update(false, dt, 1);
      setBar($('freeHold'), this.hold.v);
      return;
    }
    this.goneSince = 0;
    const best = this.app.live.best(t);
    if (best !== this.candidate) { this.candidate = best; this.hold.reset(); }
    // The letter just added must be released (shape broken or hand slid) before it repeats
    if (this.last) {
      const w = state.screen[0];
      const slid = Math.hypot(w.x - this.last.x, w.y - this.last.y) / state.palmPx > 0.25;
      if (best !== this.last.letter || slid) this.last = null;
    }
    const ok = !!best && !this.last;
    const v = this.hold.update(ok, dt, this.app.holdTime);
    setBar($('freeHold'), v, v >= 1);
    if (v >= 1) {
      this.#add(best);
      this.last = { letter: best, x: state.screen[0].x, y: state.screen[0].y };
      this.hold.reset();
    }
  }

  #add(ch) {
    if (ch === ' ' && (!this.text || this.text.endsWith(' '))) return;
    this.text += ch;
    if (ch !== ' ') {
      this.app.sound.pop();
      if (this.app.store.settings.speak) this.app.say(ch);
    }
    this.#paint();
  }

  #paint() {
    $('freeText').textContent = this.text;
  }
}
