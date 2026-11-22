// Practice: spell whole words, letter by letter. A double letter needs a small slide or a
// moment's release before the second one counts, as in real fingerspelling.
import { WORD_LISTS } from '../data/words.js';
import { Hold, setBar, feedback, pick } from './common.js';
import { keepExample } from './learn.js';

const $ = (id) => document.getElementById(id);

export class PracticeMode {
  constructor(app) {
    this.app = app;
    this.hand = app.stage('practiceHand');
    this.hold = new Hold();
    this.word = '';
    this.i = 0;
    this.skipped = new Set();
    this.release = null;
    this.wordsDone = 0;
    this.done = 0;
    const lists = $('practiceLists');
    for (const [key, list] of Object.entries(WORD_LISTS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.list = key;
      b.textContent = list.label;
      b.addEventListener('click', () => { app.store.set('list', key); this.#paintLists(); this.next(); });
      lists.append(b);
    }
    $('practiceNext').addEventListener('click', () => this.next());
    $('practiceSkipLetter').addEventListener('click', () => this.#advance(true));
    $('practiceHints').addEventListener('change', () => this.#paintHint());
  }

  stages() { return $('practiceHints').checked ? [this.hand] : []; }
  allStages() { return [this.hand]; }
  target() { return this.word[this.i]; }

  enter() {
    this.#paintLists();
    if (!this.word) this.next();
    else this.#paint();
  }

  exit() {}
  cameraChanged() { this.hold.reset(); }

  next() {
    const list = WORD_LISTS[this.app.store.settings.list] || WORD_LISTS.short;
    this.word = pick(list.words, this.word);
    this.i = 0;
    this.skipped = new Set();
    this.release = null;
    this.started = 0;
    this.done = 0;
    this.hold.reset();
    this.#paint();
  }

  frame(t, dt, state) {
    const fb = $('practiceFeedback');
    if (this.done) {
      if (t > this.done) this.next();
      return;
    }
    const target = this.word[this.i];
    if (!this.app.camera.on) {
      feedback(fb, 'Turn on your camera to check your spelling.', '', 'Or try Read mode, which needs no camera.');
      return;
    }
    if (!state || t - state.t > 0.3) {
      this.hold.update(false, dt, 1);
      setBar($('practiceHold'), this.hold.v);
      feedback(fb, `Spell ${this.word}. Show your hand to begin.`);
      return;
    }
    if (!this.started) this.started = t;
    let ok = this.app.live.accepts(target, t);
    // A repeated letter only counts after a release: the shape breaks briefly, or the hand slides
    if (this.release) {
      const w = state.screen[0];
      const slid = Math.hypot(w.x - this.release.x, w.y - this.release.y) / state.palmPx > 0.25;
      if (!ok) this.release.gone = (this.release.gone || 0) + dt;
      if (slid || this.release.gone > 0.12) this.release = null;
      else ok = false;
    }
    const v = this.hold.update(ok, dt, this.app.holdTime);
    setBar($('practiceHold'), v, v >= 1);
    if (v >= 1) { this.#advance(false, state); return; }
    const isDouble = this.i > 0 && this.word[this.i - 1] === target;
    if (this.release && isDouble) feedback(fb, `Another ${target}: slide your hand a little to the side.`, 'near');
    else if (ok) feedback(fb, 'Hold it…', 'near');
    else if (state.features && state.features.nHands === 1 && this.app.sign.handsFor(target) === 2) feedback(fb, `Next: ${target}, with both hands.`, '', 'Only one hand is in view. Keep both hands inside the picture.');
    else if (this.app.sign.moving.has(target)) feedback(fb, `${target}: make the shape, then draw the ${target} in the air.`);
    else feedback(fb, `Next: ${target}`);
  }

  #advance(skip, state) {
    const app = this.app;
    const letter = this.word[this.i];
    if (skip) this.skipped.add(this.i);
    else {
      app.sound.pop();
      if (app.store.settings.speak) app.say(letter);
      keepExample(app, letter, state);
    }
    this.i++;
    this.hold.reset();
    setBar($('practiceHold'), 0);
    // Next letter the same? It needs a release first.
    if (!skip && state && this.word[this.i] === letter) this.release = { x: state.screen[0].x, y: state.screen[0].y };
    else this.release = null;
    if (this.i >= this.word.length) this.#finish();
    else this.#paint();
  }

  #finish() {
    const app = this.app;
    const secs = Math.max(1, app.t - (this.started || app.t));
    const clean = this.skipped.size === 0;
    const lpm = Math.round((this.word.length / secs) * 60);
    app.sound.word();
    if (app.store.settings.speak) app.say(this.word.toLowerCase());
    this.wordsDone++;
    if (clean) {
      app.store.progress.words++;
      if (lpm > app.store.progress.bestLpm) app.store.progress.bestLpm = lpm;
      app.store.practised();
      app.store.save();
    }
    this.lastLpm = clean ? lpm : null;
    this.#paint();
    feedback($('practiceFeedback'), clean ? `${this.word}! ${lpm} letters a minute.` : `${this.word}, with some skipped letters.`, 'ok', 'Next word coming up.');
    this.done = app.t + 1.8;
  }

  #paint() {
    const ol = $('practiceWord');
    ol.replaceChildren(...[...this.word].map((l, k) => {
      const li = document.createElement('li');
      li.textContent = l;
      if (k < this.i) li.className = this.skipped.has(k) ? 'skipped' : 'done';
      else if (k === this.i) li.className = 'current';
      return li;
    }));
    ol.setAttribute('aria-label', `Word: ${this.word}. Letter ${Math.min(this.i + 1, this.word.length)} of ${this.word.length}`);
    $('practiceNote').textContent = (WORD_LISTS[this.app.store.settings.list] || WORD_LISTS.short).note;
    this.#paintHint();
    const p = this.app.store.progress;
    $('practiceStats').innerHTML = `
      <div><dt>Words this session</dt><dd>${this.wordsDone}</dd></div>
      <div><dt>Last word</dt><dd>${this.lastLpm ? `${this.lastLpm}<small> a min</small>` : '–'}</dd></div>
      <div><dt>Your best</dt><dd>${p.bestLpm ? `${p.bestLpm}<small> a min</small>` : '–'}</dd></div>`;
  }

  #paintHint() {
    const l = this.word[this.i];
    $('practiceHand').style.visibility = $('practiceHints').checked && l ? 'visible' : 'hidden';
    if (l && this.hand.letter !== l) this.hand.show(l);
  }

  #paintLists() {
    document.querySelectorAll('#practiceLists button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.list === this.app.store.settings.list)));
  }
}
