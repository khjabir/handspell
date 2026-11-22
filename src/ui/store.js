// Settings, progress and your recorded letters, kept in this browser's local storage.
// Progress and recorded letters are kept separately for each alphabet (ASL and ISL).

const KEY = 'handspell:v1';

const DEFAULTS = {
  settings: {
    alphabet: 'asl', // 'asl' (American) or 'isl' (Indian)
    hand: 'right', // which hand you sign with
    view: 'mirror', // reference hand: 'mirror' (like your camera) or 'others' (as others see you)
    skin: 'medium',
    strictness: 'normal',
    hold: 0.5, // seconds to hold a letter
    outline: true, // draw your hand's outline on the camera picture
    sounds: true,
    speak: false, // say each letter aloud
    readSpeed: 1.8,
    list: 'short',
    readList: 'short',
  },
  progress: {
    learned: {}, // letter -> times signed correctly in Learn
    words: 0,
    bestLpm: 0, // letters per minute in Practice
    read: { right: 0, tries: 0, bestStreak: 0 },
    gameBest: 0,
    days: [], // dates you practised, YYYY-MM-DD
  },
  templates: {}, // letter -> [measurements], from "Teach it my letter"
};

const progressFrom = (p = {}) => ({ ...structuredClone(DEFAULTS.progress), ...p, read: { ...DEFAULTS.progress.read, ...(p.read || {}) } });

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      settings: { ...DEFAULTS.settings, ...(raw.settings || {}) },
      // ASL lives at the top level (as before ISL was added); ISL in its own book
      asl: { progress: progressFrom(raw.progress), templates: raw.templates || {} },
      isl: { progress: progressFrom((raw.isl || {}).progress), templates: (raw.isl || {}).templates || {} },
    };
  } catch (err) {
    return { settings: { ...DEFAULTS.settings }, asl: { progress: progressFrom(), templates: {} }, isl: { progress: progressFrom(), templates: {} } };
  }
}

export class Store {
  constructor() {
    const d = load();
    this.settings = d.settings;
    this.books = { asl: d.asl, isl: d.isl };
    this.listeners = new Set();
  }

  /** The book (progress and recorded letters) of the alphabet in use. */
  get book() { return this.books[this.settings.alphabet] || this.books.asl; }
  get progress() { return this.book.progress; }
  set progress(p) { this.book.progress = p; }
  get templates() { return this.book.templates; }
  set templates(t) { this.book.templates = t; }

  save() {
    try {
      const { asl, isl } = this.books;
      localStorage.setItem(KEY, JSON.stringify({ settings: this.settings, progress: asl.progress, templates: asl.templates, isl }));
    } catch (err) { /* storage full or blocked: keep going without saving */ }
    for (const fn of this.listeners) fn();
  }

  onChange(fn) { this.listeners.add(fn); }

  set(key, value) {
    this.settings[key] = value;
    this.save();
  }

  /** Mark today as a practice day (days count for both alphabets together). */
  practised() {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const days = this.books.asl.progress.days;
    if (days[days.length - 1] !== today) {
      days.push(today);
      if (days.length > 400) days.splice(0, days.length - 400);
      this.save();
    }
  }

  /** Days in a row, counting today or yesterday as the latest. */
  get streak() {
    const days = new Set(this.books.asl.progress.days);
    const d = new Date();
    const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    if (!days.has(fmt(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days.has(fmt(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  get learnedCount() { return Object.keys(this.progress.learned).length; }

  learn(letter) {
    this.progress.learned[letter] = (this.progress.learned[letter] || 0) + 1;
    this.practised();
    this.save();
  }

  addTemplates(letter, list, keep = 12) {
    this.templates[letter] = [...(this.templates[letter] || []), ...list].slice(-keep);
    this.save();
  }

  clearTemplates() {
    this.templates = {};
    this.save();
  }

  /** Reset the progress of the alphabet in use (practice days are kept with ASL's). */
  resetProgress() {
    const days = this.settings.alphabet === 'asl' ? [] : this.books.asl.progress.days;
    this.progress = progressFrom();
    this.books.asl.progress.days = days;
    this.save();
  }
}
