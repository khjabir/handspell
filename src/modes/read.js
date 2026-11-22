// Read: the hand fingerspells a word and you type what you saw. No camera needed.
import { WORD_LISTS } from '../data/words.js';
import { feedback, pick } from './common.js';

const $ = (id) => document.getElementById(id);

export class ReadMode {
  constructor(app) {
    this.app = app;
    this.hand = app.stage('readHand');
    this.word = '';
    this.streak = 0;
    this.revealed = false;
    this.solved = false;
    const lists = $('readLists');
    for (const [key, list] of Object.entries(WORD_LISTS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.list = key;
      b.textContent = list.label;
      b.addEventListener('click', () => { app.store.set('readList', key); this.#paintControls(); this.next(); });
      lists.append(b);
    }
    document.querySelectorAll('#readSpeed button').forEach((b) => b.addEventListener('click', () => {
      app.store.set('readSpeed', Number(b.dataset.speed));
      this.#paintControls();
      this.play();
    }));
    $('readReplay').addEventListener('click', () => this.play());
    $('readNext').addEventListener('click', () => this.next());
    $('readReveal').addEventListener('click', () => this.reveal());
    $('readForm').addEventListener('submit', (e) => { e.preventDefault(); this.check(); });
  }

  stages() { return [this.hand]; }
  allStages() { return [this.hand]; }

  enter() {
    this.#paintControls();
    this.#paintStats();
    if (!this.word) this.next();
    else this.play();
  }

  exit() { this.hand.stop(); }
  frame() {}

  next() {
    const list = WORD_LISTS[this.app.store.settings.readList] || WORD_LISTS.short;
    this.word = pick(list.words, this.word);
    this.revealed = false;
    this.solved = false;
    $('readInput').value = '';
    feedback($('readFeedback'), '');
    this.play();
    if (!this.app.reduceMotion) $('readInput').focus({ preventScroll: true });
  }

  play() {
    this.app.sound.unlock();
    this.hand.spell(this.word, this.app.store.settings.readSpeed || 1.8);
  }

  check() {
    const app = this.app;
    const guess = $('readInput').value.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (!guess) { feedback($('readFeedback'), 'Type the word you saw first.'); return; }
    const p = app.store.progress.read;
    if (this.solved) { this.next(); return; }
    p.tries++;
    if (guess === this.word) {
      this.solved = true;
      if (!this.revealed) {
        p.right++;
        this.streak++;
        p.bestStreak = Math.max(p.bestStreak, this.streak);
      }
      app.store.practised();
      app.store.save();
      app.sound.word();
      feedback($('readFeedback'), `Right, it was ${this.word}.`, 'ok', 'Press Check again or Next word to carry on.');
    } else {
      this.streak = 0;
      app.store.save();
      app.sound.miss();
      const close = guess.length === this.word.length ? [...guess].filter((c, i) => c === this.word[i]).length : 0;
      feedback($('readFeedback'), 'Not quite.', '', close ? `${close} of the ${this.word.length} letters are right. Play it again?` : `It has ${this.word.length} letters. Play it again?`);
    }
    this.#paintStats();
  }

  reveal() {
    if (!this.solved) {
      this.revealed = true;
      this.streak = 0;
    }
    feedback($('readFeedback'), `It was ${this.word}.`, '', 'Watch it once more, slowly.');
    this.hand.spell(this.word, 1);
    this.#paintStats();
  }

  #paintControls() {
    const s = this.app.store.settings;
    document.querySelectorAll('#readLists button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.list === s.readList)));
    document.querySelectorAll('#readSpeed button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === Number(s.readSpeed))));
  }

  #paintStats() {
    const p = this.app.store.progress.read;
    $('readStats').innerHTML = `
      <div><dt>In a row</dt><dd>${this.streak}</dd></div>
      <div><dt>Best run</dt><dd>${p.bestStreak}</dd></div>
      <div><dt>Words read</dt><dd>${p.right}</dd></div>`;
  }
}
