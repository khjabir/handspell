// Learn: one letter at a time. The reference hand shows the shape; the camera checks yours,
// says what to change, and moves on when you have it. Also runs the ISL setup, which records
// the signer's own version of every letter in turn.
import { ALPHABET } from '../sign/letters.js';
import { Hold, setBar, feedback } from './common.js';

const $ = (id) => document.getElementById(id);

/**
 * ISL: a letter signed right is also kept as one of the signer's own examples, so recognition
 * keeps adapting to their hands, camera and light. Only when the letter was the clear top match.
 */
export function keepExample(app, letter, state) {
  if (app.sign.id !== 'isl' || !state || !state.features || state.ranked[0].letter !== letter) return;
  app.store.addTemplates(letter, [app.live.templateOf(state.features)]);
  app.live.setTemplates(app.store.templates);
}

export class LearnMode {
  constructor(app) {
    this.app = app;
    this.hand = app.stage('learnHand');
    this.hold = new Hold();
    this.index = Math.max(0, ALPHABET.indexOf(app.store.settings.lastLetter || 'A'));
    this.celebrating = 0;
    this.recording = null;
    this.setup = null; // { done: number } while recording the whole alphabet
    this.hintAt = 0;
    this.hint = '';
    this.#buildStrip();
    $('setupStart').addEventListener('click', () => this.startSetup());
    $('setupLater').addEventListener('click', () => { app.store.set('islSetupLater', true); this.#paintSetup(); });
    $('setupSkip').addEventListener('click', () => this.#setupNext(false));
    $('setupStop').addEventListener('click', () => this.stopSetup());
    $('learnPrev').addEventListener('click', () => this.go(this.index - 1));
    $('learnNext').addEventListener('click', () => this.go(this.index + 1));
    $('learnView').addEventListener('click', () => {
      const s = app.store.settings;
      app.store.set('view', s.view === 'mirror' ? 'others' : 'mirror');
      app.applySettings();
    });
    $('learnStraighten').addEventListener('click', () => this.hand.straighten());
    $('learnTeach').addEventListener('click', () => this.teach());
    document.addEventListener('keydown', (e) => {
      if (app.modeName !== 'learn' || e.target.closest('input, textarea, select, .hand')) return;
      if (e.key === 'ArrowRight') this.go(this.index + 1);
      else if (e.key === 'ArrowLeft') this.go(this.index - 1);
      else if (/^[a-z]$/i.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) this.go(ALPHABET.indexOf(e.key.toUpperCase()));
    });
  }

  stages() { return [this.hand]; }
  allStages() { return [this.hand]; }
  target() { return ALPHABET[this.index]; }

  applySettings() {
    $('learnView').textContent = this.app.store.settings.view === 'mirror' ? 'Showing: like a mirror' : 'Showing: as others see you';
    this.#paintStrip();
    this.#paintSetup();
  }

  enter() {
    this.show();
    this.#paintSetup();
  }

  exit() {
    this.recording = null;
    if (this.setup) this.stopSetup();
  }

  cameraChanged() { this.hold.reset(); }

  go(i) {
    if (i < 0 || i >= ALPHABET.length) return;
    this.index = i;
    this.app.store.settings.lastLetter = ALPHABET[i];
    this.app.store.save();
    this.show();
  }

  show() {
    const l = ALPHABET[this.index];
    const def = this.app.sign.letters[l];
    const big = $('learnLetter');
    big.textContent = l;
    big.classList.remove('stamp');
    $('learnHow').textContent = def.how;
    $('learnTip').textContent = def.tip;
    $('learnTeach').textContent = `Teach it my ${l}`;
    $('learnPrev').disabled = this.index === 0;
    $('learnNext').disabled = this.index === ALPHABET.length - 1;
    this.hand.show(l);
    this.hold.reset();
    this.celebrating = 0;
    this.hint = '';
    this.trying = 0; // seconds spent trying this letter with hands in view
    setBar($('learnHold'), 0);
    this.#paintStrip();
  }

  frame(t, dt, state) {
    const l = ALPHABET[this.index];
    const fb = $('learnFeedback');
    if (this.recording) { this.#record(t, state); return; }
    if (this.celebrating) {
      if (t > this.celebrating) {
        this.celebrating = 0;
        if (this.index < ALPHABET.length - 1) this.go(this.index + 1);
      }
      return;
    }
    if (!this.app.camera.on) {
      feedback(fb, `Copy the hand, then turn on your camera to check your ${l}.`, '', 'Drag the hand to look at it from any side.');
      return;
    }
    if (!state || t - state.t > 0.3) {
      this.hold.update(false, dt, 1);
      setBar($('learnHold'), this.hold.v);
      feedback(fb, 'Hold your hand up to the camera.', '', 'About a forearm’s length away, with your palm facing the camera.');
      return;
    }
    const ok = this.app.live.accepts(l, t);
    const v = this.hold.update(ok, dt, this.app.holdTime);
    setBar($('learnHold'), v, v >= 1);
    if (v >= 1) { this.#success(l, t, state); return; }
    this.trying += dt;
    if (ok) { feedback(fb, 'That’s it. Hold it…', 'near'); return; }
    const moving = this.app.sign.moving.has(l);
    if (moving) {
      const base = l === 'J' ? Math.max(this.app.live.ema.I, this.app.live.ema.J) : Math.max(this.app.live.ema.Z, this.app.live.ema.D);
      feedback(fb, base > 0.35 ? `Good start. Now draw the ${l} in the air.` : `Start with the hand shape for ${l === 'J' ? 'I' : 'a pointing index finger'}.`, base > 0.35 ? 'near' : '');
      return;
    }
    // Advice, refreshed now and then so it doesn't flicker
    if (t - this.hintAt > 0.6) {
      this.hintAt = t;
      const best = this.app.live.best(t);
      const tip = this.app.live.hintFor(l, state.features);
      const isl = this.app.sign.id === 'isl';
      const fallback = isl ? `Almost there. If your ${l} is made differently, “Teach it my ${l}” records yours.` : 'Almost there.';
      const fix = tip ? `${tip}.` : isl ? 'Check the drawing, or teach it your version.' : '';
      // With a hand missing, what the other hand alone looks like is beside the point
      const oneHandShort = isl && this.app.sign.handsFor(l) === 2 && state.features.nHands === 1;
      this.hint = best && best !== l && !oneHandShort ? `That looks like ${best}. ${fix}` : tip ? `${tip}.` : fallback;
    }
    // Stuck for a while: the signer's own version is probably just different
    const stuck = this.trying > 8 ? `Still not recognised? “Teach it my ${l}” records your version.` : '';
    feedback(fb, this.hint, '', stuck);
  }

  #success(l, t, state) {
    const app = this.app;
    app.store.learn(l);
    keepExample(app, l, state);
    app.sound.ok();
    if (app.store.settings.speak) app.say(l);
    feedback($('learnFeedback'), `Yes! That’s ${l}.`, 'ok', this.index < ALPHABET.length - 1 ? 'On to the next letter.' : 'You have signed the whole alphabet.');
    const big = $('learnLetter');
    big.classList.remove('stamp');
    void big.offsetWidth;
    big.classList.add('stamp');
    this.celebrating = t + 1.5;
    this.#paintStrip();
  }

  /** Record a few examples of the user's own version of the letter. */
  teach(wait = 2.2) {
    const app = this.app;
    const l = ALPHABET[this.index];
    if (!app.camera.on) { app.toast('Turn on your camera first.'); return false; }
    if (app.sign.moving.has(l)) { app.toast(`${l} is recognised by its movement, so there is nothing to record.`); return false; }
    this.recording = { letter: l, start: app.t + wait, end: app.t + wait + 1.6, samples: [], last: 0 };
    return true;
  }

  #record(t, state) {
    const r = this.recording;
    const fb = $('learnFeedback');
    const hands = this.app.sign.handsFor(r.letter) === 2 ? 'hands' : 'hand';
    if (t < r.start) {
      feedback(fb, `Make your ${r.letter} and hold it still… ${Math.ceil(r.start - t)}`, 'near');
      return;
    }
    if (state && t - state.t < 0.2 && t - r.last > 0.12) {
      r.samples.push(this.app.live.templateOf(state.features));
      r.last = t;
    }
    setBar($('learnHold'), Math.min(1, (t - r.start) / (r.end - r.start)));
    feedback(fb, `Recording your ${r.letter}…`, 'near');
    if (t >= r.end) {
      this.recording = null;
      setBar($('learnHold'), 0);
      if (r.samples.length < 4) {
        feedback(fb, `I couldn’t see your ${hands} clearly. Try again with your ${hands} in view.`);
        if (this.setup) this.#setupRetry();
        return;
      }
      // Keep a handful, spread over the recording
      const keep = this.app.sign.id === 'isl' ? 6 : 12;
      const step = Math.max(1, r.samples.length / keep);
      const samples = [];
      for (let k = 0; k < r.samples.length && samples.length < keep; k += step) samples.push(r.samples[Math.floor(k)]);
      this.app.store.addTemplates(r.letter, samples);
      this.app.applySettings();
      if (this.setup) { this.#setupNext(true); return; }
      feedback(fb, `Saved ${samples.length} examples of your ${r.letter}. I’ll recognise it better now.`, 'ok');
    }
  }

  /* ---------- ISL setup: record every letter once ---------- */

  startSetup() {
    const app = this.app;
    if (!app.camera.on) {
      app.toast('Turn on your camera first, then start the setup.');
      feedback($('learnFeedback'), 'Turn on your camera, then press Start setup.', 'near');
      return;
    }
    this.setup = { done: 0, retries: 0 };
    this.go(0);
    this.teach(3);
    this.#paintSetup();
  }

  stopSetup(finished = false) {
    this.setup = null;
    this.recording = null;
    setBar($('learnHold'), 0);
    if (finished) {
      this.app.store.set('islSetupLater', true);
      feedback($('learnFeedback'), 'All done. Handspell now knows your ISL alphabet.', 'ok', 'Try Practice, or carry on learning here. You can re-record any letter with “Teach it my letter”.');
      this.app.sound.word();
    }
    this.#paintSetup();
  }

  #setupNext(recorded) {
    const s = this.setup;
    if (!s) return;
    if (recorded) { s.done++; this.app.sound.pop(); }
    s.retries = 0;
    if (this.index >= ALPHABET.length - 1) { this.stopSetup(true); return; }
    this.go(this.index + 1);
    this.teach(2.6);
    this.#paintSetup();
  }

  #setupRetry() {
    const s = this.setup;
    s.retries++;
    if (s.retries > 1) { this.#setupNext(false); return; }
    this.teach(2.6);
  }

  #paintSetup() {
    const app = this.app;
    const isl = app.sign.id === 'isl';
    const taught = Object.keys(app.store.templates).length;
    $('setupCard').hidden = !isl || !!this.setup || taught >= 13 || !!app.store.settings.islSetupLater;
    $('setupBar').hidden = !this.setup;
    if (this.setup) $('setupCount').textContent = `Recording your alphabet: ${this.index + 1} of 26`;
    document.querySelector('[data-panel="learn"] .lesson-actions').hidden = !!this.setup;
  }

  #buildStrip() {
    const nav = $('alphabet');
    ALPHABET.forEach((l, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = l;
      b.addEventListener('click', () => this.go(i));
      nav.append(b);
    });
  }

  #paintStrip() {
    const learned = this.app.store.progress.learned;
    document.querySelectorAll('#alphabet button').forEach((b, i) => {
      const l = ALPHABET[i];
      b.classList.toggle('learned', !!learned[l]);
      b.setAttribute('aria-current', String(i === this.index));
      b.setAttribute('aria-label', `${l}${learned[l] ? ', learned' : ''}`);
    });
  }
}
