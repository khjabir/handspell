// Handspell: wires the camera, hand tracking, letter recognition and the five modes together,
// for either alphabet: ASL (one hand) or ISL (mostly two hands, loaded when first chosen).
import { HandTracker } from './tracking/mediapipe.js';
import { FaceTracker } from './tracking/face.js';
import { LiveSign } from './sign/live.js';
import { STRICTNESS } from './sign/recognizer.js';
import { LETTERS, MOVING } from './sign/letters.js';
import { ISL_LETTERS } from './sign/isl/letters.js';
import { HandStage } from './hand3d/stage.js';
import { SKIN } from './hand3d/render.js';
import { Store } from './ui/store.js';
import { sound, say } from './ui/sound.js';
import { LearnMode } from './modes/learn.js';
import { PracticeMode } from './modes/practice.js';
import { ReadMode } from './modes/read.js';
import { GameMode } from './modes/game.js';
import { FreeMode } from './modes/free.js';

const $ = (id) => document.getElementById(id);
const video = $('video');
const overlay = $('overlay');
const octx = overlay.getContext('2d');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const store = new Store();
const aslLive = new LiveSign();
let islLive = null; // loaded the first time ISL is chosen
const tracker = new HandTracker();
const face = new FaceTracker();

/** What the modes need to know about each alphabet. */
const ALPHABETS = {
  asl: {
    id: 'asl',
    name: 'ASL',
    long: 'American Sign Language',
    letters: LETTERS,
    moving: new Set(MOVING),
    handsFor: () => 1,
  },
  isl: {
    id: 'isl',
    name: 'ISL',
    long: 'Indian Sign Language',
    letters: ISL_LETTERS,
    moving: new Set(),
    handsFor: (l) => ISL_LETTERS[l].hands,
  },
};

const app = {
  tracker,
  face,
  store,
  get live() { return store.settings.alphabet === 'isl' && islLive ? islLive : aslLive; },
  get sign() { return ALPHABETS[store.settings.alphabet === 'isl' && islLive ? 'isl' : 'asl']; },
  sound,
  say,
  reduceMotion,
  camera: { on: false, stream: null },
  t: 0,
  mode: null,
  toast,
  /** Raw (unmirrored, 0..1) camera point to pixels on the mirrored camera picture. */
  toScreen(p) {
    const m = app.cover;
    return { x: m.ox + (1 - p.x) * m.dw, y: m.oy + p.y * m.dh };
  },
  cover: { ox: 0, oy: 0, dw: 1, dh: 1, W: 1, H: 1 },
  stage(id) {
    return new HandStage($(id), { reduceMotion, mirror: mirrorRef(), skin: store.settings.skin, alphabet: app.sign.id });
  },
  get holdTime() { return Number(store.settings.hold) || 0.5; },
};
window.handspell = app; // for the browser console

/** The reference hand is drawn as a right hand; flip it for a mirror view or a left hand. */
function mirrorRef() {
  return (store.settings.view === 'mirror') !== (store.settings.hand === 'left');
}

/* ---------- camera ---------- */

function cameraError(err) {
  switch (err && err.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access is blocked. Allow the camera for this site in your browser’s settings, then try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found. Connect one, or use Read mode, which needs no camera.';
    case 'NotReadableError':
      return 'Another app is using the camera. Close it there, then try again.';
    default:
      return `The camera could not start (${(err && err.message) || 'unknown error'}).`;
  }
}

async function startCamera() {
  const msg = $('camMsg');
  const btn = $('camStart');
  msg.classList.remove('error');
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg.textContent = 'The camera only works on a secure page. Open Handspell over https, or at http://localhost.';
    msg.classList.add('error');
    return;
  }
  btn.disabled = true;
  sound.unlock();
  msg.textContent = 'Starting the camera…';
  const ready = tracker.init();
  ready.catch(() => {});
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
  } catch (err) {
    msg.textContent = cameraError(err);
    msg.classList.add('error');
    btn.disabled = false;
    return;
  }
  video.srcObject = stream;
  try { await video.play(); } catch (e) { /* muted video autoplays */ }
  msg.textContent = 'Loading hand tracking. The first time takes a few seconds.';
  try {
    await ready;
  } catch (err) {
    console.error(err);
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    msg.textContent = 'Hand tracking could not load. It downloads about 20 MB the first time, so check your connection and try again.';
    msg.classList.add('error');
    btn.disabled = false;
    return;
  }
  app.camera = { on: true, stream };
  msg.textContent = '';
  btn.disabled = false;
  $('camOff').hidden = true;
  $('camStop').hidden = false;
  store.practised();
  if (app.sign.id === 'isl') {
    face.init().catch(() => {});
    nudgeSetup();
  }
  if (app.mode && app.mode.cameraChanged) app.mode.cameraChanged(true);
}

function stopCamera() {
  if (app.camera.stream) app.camera.stream.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
  app.camera = { on: false, stream: null };
  app.live.reset();
  $('camOff').hidden = false;
  $('camStop').hidden = true;
  if (app.mode && app.mode.cameraChanged) app.mode.cameraChanged(false);
}

$('camStart').addEventListener('click', startCamera);
$('camStop').addEventListener('click', stopCamera);

/* ---------- modes ---------- */

const modes = {};
app.modes = modes;
function setMode(name) {
  if (!modes[name]) return;
  if (app.mode === modes[name]) return;
  if (app.mode) app.mode.exit();
  document.body.className = `mode-${name}`;
  document.querySelectorAll('.modes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === name)));
  app.mode = modes[name];
  app.modeName = name;
  resize();
  app.mode.enter();
  history.replaceState(null, '', `#${name}`);
}
app.setMode = setMode;

document.querySelectorAll('.modes button').forEach((b) => b.addEventListener('click', () => { sound.unlock(); setMode(b.dataset.mode); }));

/* ---------- layout and drawing ---------- */

function resize() {
  const r = overlay.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  overlay.width = Math.max(1, Math.round(r.width * dpr));
  overlay.height = Math.max(1, Math.round(r.height * dpr));
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
  const s = Math.max(r.width / vw, r.height / vh);
  app.cover = { ox: (r.width - vw * s) / 2, oy: (r.height - vh * s) / 2, dw: vw * s, dh: vh * s, W: r.width, H: r.height };
}
window.addEventListener('resize', resize);
video.addEventListener('loadedmetadata', resize);

const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

function drawCamera(state, t) {
  const { W, H } = app.cover;
  octx.clearRect(0, 0, W, H);
  const guess = $('guess');
  if (!state || t - state.t > 0.3) {
    guess.classList.remove('show');
    if (app.mode && app.mode.drawOverlay) app.mode.drawOverlay(octx, t, null);
    return;
  }
  const hands = state.hands || [state.screen];
  if (store.settings.outline) {
    octx.save();
    octx.lineCap = 'round';
    octx.lineJoin = 'round';
    octx.strokeStyle = 'rgba(243, 244, 248, 0.85)';
    octx.lineWidth = Math.max(2, state.palmPx * 0.035);
    octx.beginPath();
    for (const P of hands) for (const [a, b] of BONES) { octx.moveTo(P[a].x, P[a].y); octx.lineTo(P[b].x, P[b].y); }
    octx.stroke();
    octx.fillStyle = '#FF48B0';
    for (const P of hands) {
      for (const i of [4, 8, 12, 16, 20]) {
        octx.beginPath();
        octx.arc(P[i].x, P[i].y, Math.max(3, state.palmPx * 0.05), 0, Math.PI * 2);
        octx.fill();
      }
    }
    octx.restore();
  }
  // The guess floats above the hands
  let best = app.live.best(t);
  // A two-hand letter is being asked for but only one hand is in view: a guess would mislead
  const target = app.mode && app.mode.target ? app.mode.target() : null;
  if (target && app.sign.handsFor(target) === 2 && state.features && state.features.nHands === 1) best = null;
  const P = hands.flat();
  let minY = Infinity, sumX = 0;
  for (const p of P) { minY = Math.min(minY, p.y); sumX += p.x; }
  if (best && (!app.mode || app.mode.showGuess !== false)) {
    guess.textContent = best;
    guess.style.left = `${Math.max(30, Math.min(W - 30, sumX / P.length))}px`;
    guess.style.top = `${Math.max(48, minY - 14)}px`;
    guess.classList.add('show');
    guess.classList.toggle('ok', !!(app.mode && app.mode.target && app.mode.target() === best));
  } else {
    guess.classList.remove('show');
  }
  if (app.mode && app.mode.drawOverlay) app.mode.drawOverlay(octx, t, state);
}

let lastVideoTime = -1;
let errorShown = false;
let faceTick = 0;
function frame(nowMs) {
  const t = nowMs / 1000;
  const dt = Math.min(0.05, Math.max(0, t - (app.t || t)));
  app.t = t;
  const live = app.live;
  let state = live.state;
  if (app.camera.on && tracker.landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    try {
      const res = tracker.detect(video);
      // ISL's I points at the face: look for one every third frame
      let seen = null;
      if (live.id === 'isl' && face.detector) {
        faceTick = (faceTick + 1) % 3;
        seen = faceTick === 0 ? face.detect(video, t) : face.last && t - face.last.t < 0.5 ? face.last : null;
      }
      state = live.update(res, video.videoWidth / video.videoHeight, app.toScreen, t, seen);
    } catch (err) {
      if (!errorShown) { console.error(err); errorShown = true; }
    }
  }
  if (!app.camera.on) state = null;
  try {
    if (app.mode) app.mode.frame(t, dt, state);
  } catch (err) {
    if (!errorShown) { console.error(err); errorShown = true; }
  }
  if (app.modeName !== 'read') drawCamera(state, t);
  for (const s of activeStages()) s.draw(t);
  requestAnimationFrame(frame);
}

function activeStages() {
  return app.mode && app.mode.stages ? app.mode.stages() : [];
}

/* ---------- settings ---------- */

function applySettings() {
  const s = store.settings;
  sound.enabled = !!s.sounds;
  aslLive.signingHand = s.hand;
  app.live.setStrictness(s.strictness);
  app.live.setTemplates(store.templates);
  for (const m of Object.values(modes)) {
    for (const st of m.allStages ? m.allStages() : []) st.set({ mirror: mirrorRef(), skin: s.skin, alphabet: app.sign.id });
    if (m.applySettings) m.applySettings();
  }
  paintAlphabet();
  renderSummary();
}
app.applySettings = applySettings;

function renderSummary() {
  const n = store.learnedCount;
  const streak = store.streak;
  $('progressSummary').innerHTML = `<b>${n}</b> of 26 ${app.sign.name} letters learned${streak > 1 ? `<br><b>${streak}</b> days in a row` : ''}`;
}

/* ---------- alphabet ---------- */

async function loadIsl() {
  if (islLive) return;
  const { IslLive } = await import('./sign/isl/live.js');
  islLive = new IslLive();
}

/** Switch between ASL and ISL. Progress and recorded letters are kept for each. */
async function setAlphabet(id) {
  if (id === store.settings.alphabet && (id === 'asl' || islLive)) return;
  if (id === 'isl') {
    toast('Loading the ISL alphabet…');
    try {
      await loadIsl();
    } catch (err) {
      console.error(err);
      toast('The ISL alphabet could not load. Check your connection and try again.');
      return;
    }
    if (app.camera.on) face.init().catch(() => {});
  }
  aslLive.reset();
  if (islLive) islLive.reset();
  tracker.setSensitivity(id === 'isl' ? 'twoHands' : 'normal');
  store.set('alphabet', id);
  applySettings();
  if (app.mode) { app.mode.exit(); app.mode.enter(); }
  toast(id === 'isl' ? 'Indian Sign Language (ISL)' : 'American Sign Language (ASL)');
  if (id === 'isl' && app.camera.on) nudgeSetup();
}
app.setAlphabet = setAlphabet;

/** ISL recognition improves most from the signer's own examples: say so once per visit. */
let nudged = false;
function nudgeSetup() {
  if (nudged || app.sign.id !== 'isl' || Object.keys(store.templates).length >= 13 || app.modeName === 'learn') return;
  nudged = true;
  toast('Tip: the two-minute setup in Learn teaches Handspell your ISL hands, and recognition gets much better.', 6000);
}

function paintAlphabet() {
  const id = app.sign.id;
  document.querySelectorAll('[data-alphabet]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.alphabet === id)));
  document.documentElement.dataset.alphabet = id;
  document.title = `Handspell: learn the ${id.toUpperCase()} alphabet with your webcam`;
}
document.querySelectorAll('[data-alphabet]').forEach((b) => b.addEventListener('click', () => setAlphabet(b.dataset.alphabet)));

function option(name, label, choices, note) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<span>${label}</span><div class="seg" role="group" aria-label="${label}"></div>${note ? `<p class="note">${note}</p>` : ''}`;
  const seg = row.querySelector('.seg');
  for (const [value, text] of choices) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.setAttribute('aria-pressed', String(String(store.settings[name]) === String(value)));
    b.addEventListener('click', () => {
      store.set(name, value);
      seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      applySettings();
    });
    seg.append(b);
  }
  return row;
}

function toggle(name, label) {
  const row = document.createElement('label');
  row.className = 'switch row';
  row.innerHTML = `<input type="checkbox"${store.settings[name] ? ' checked' : ''}><span>${label}</span>`;
  row.querySelector('input').addEventListener('change', (e) => { store.set(name, e.target.checked); applySettings(); });
  return row;
}

function renderSettings() {
  const body = $('settingsBody');
  body.replaceChildren();
  const h = (text) => { const el = document.createElement('h3'); el.textContent = text; body.append(el); };
  h('Alphabet');
  const al = document.createElement('div');
  al.className = 'row';
  al.innerHTML = '<span>Fingerspell in</span><div class="seg" role="group" aria-label="Alphabet"></div><p class="note">ASL, American Sign Language, spells with one hand. ISL, Indian Sign Language, uses both hands for most letters. Progress is kept for each.</p>';
  for (const [id, text] of [['asl', 'ASL'], ['isl', 'ISL']]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.dataset.alphabet = id;
    b.setAttribute('aria-pressed', String(app.sign.id === id));
    b.addEventListener('click', async () => { await setAlphabet(id); renderSettings(); });
    al.querySelector('.seg').append(b);
  }
  body.append(al);
  h('Your signing');
  body.append(option('hand', 'I sign with my', [['right', 'Right hand'], ['left', 'Left hand']], app.sign.id === 'isl' ? 'This sets which way the reference hands are drawn. In ISL either hand can lead.' : ''));
  body.append(option('strictness', 'Checking', Object.keys(STRICTNESS).map((k) => [k, k[0].toUpperCase() + k.slice(1)]), 'Relaxed lets more through while you learn; strict wants a crisp handshape.'));
  body.append(option('hold', 'Hold each letter for', [[0.3, 'Short'], [0.5, 'Medium'], [0.8, 'Long']]));
  h('The reference hand');
  body.append(option('view', 'Show it', [['mirror', 'Like a mirror'], ['others', 'As others see me']], 'Like a mirror matches your camera picture, so you can copy it directly.'));
  const sk = document.createElement('div');
  sk.className = 'row';
  sk.innerHTML = '<span>Skin tone</span><div class="swatches" role="group" aria-label="Skin tone"></div>';
  const names = { light: 'Light', medium: 'Medium', tan: 'Tan', deep: 'Deep', glove: 'White glove' };
  for (const [k, v] of Object.entries(SKIN)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.background = v.fill;
    b.title = names[k];
    b.setAttribute('aria-label', names[k]);
    b.setAttribute('aria-pressed', String(store.settings.skin === k));
    b.addEventListener('click', () => {
      store.set('skin', k);
      sk.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      applySettings();
    });
    sk.querySelector('.swatches').append(b);
  }
  body.append(sk);
  h('Camera and sound');
  body.append(toggle('outline', 'Draw my hand’s outline on the camera picture'));
  body.append(toggle('sounds', 'Play sounds'));
  body.append(toggle('speak', 'Say each letter aloud when I get it right'));
  h(`My recorded ${app.sign.name} letters`);
  const rec = document.createElement('div');
  rec.className = 'row';
  const count = Object.values(store.templates).reduce((a, l) => a + l.length, 0);
  const letters = Object.keys(store.templates).sort().join(', ');
  rec.innerHTML = `<p class="note">${count ? `You have taught Handspell your own ${letters}. They help it recognise your hands.` : 'In Learn, “Teach it my letter” records your own version of a letter, which helps if Handspell struggles with your hand.'}</p>`;
  if (app.sign.id === 'isl') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = count ? 'Record my whole alphabet again' : 'Teach Handspell my ISL alphabet';
    b.addEventListener('click', () => { toggleSettings(false); setMode('learn'); modes.learn.startSetup(); });
    rec.append(b);
  }
  if (count) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = 'Forget my recorded letters';
    b.addEventListener('click', () => { store.clearTemplates(); applySettings(); renderSettings(); toast('Recorded letters removed'); });
    rec.append(b);
  }
  body.append(rec);
  h('Progress');
  const pr = document.createElement('div');
  pr.className = 'row';
  pr.innerHTML = `<p class="note">Your progress is saved in this browser only, separately for ASL and ISL.</p>`;
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'btn';
  reset.textContent = 'Reset my progress';
  reset.addEventListener('click', () => {
    if (!confirm(`Reset your ${app.sign.name} progress? Learned letters and scores will be cleared.`)) return;
    store.resetProgress();
    applySettings();
    toast('Progress reset');
  });
  pr.append(reset);
  body.append(pr);
}

function toggleSettings(open) {
  const el = $('settings');
  const next = open === undefined ? el.hidden : open;
  if (next) renderSettings();
  el.hidden = !next;
  $('settingsBtn').setAttribute('aria-expanded', String(next));
  if (next) el.querySelector('button')?.focus();
}
$('settingsBtn').addEventListener('click', () => toggleSettings());
$('settingsClose').addEventListener('click', () => toggleSettings(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('settings').hidden) toggleSettings(false);
});

let toastTimer = null;
function toast(msg, ms = 2600) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------- boot ---------- */

// ?alphabet=isl (or asl) in the address picks the alphabet, so a link can open either
const asked = new URLSearchParams(location.search).get('alphabet');
if (asked === 'isl' || asked === 'asl') store.settings.alphabet = asked;
if (store.settings.alphabet === 'isl') {
  try { await loadIsl(); } catch (err) { console.error(err); store.settings.alphabet = 'asl'; }
}
tracker.setSensitivity(store.settings.alphabet === 'isl' ? 'twoHands' : 'normal');

modes.learn = new LearnMode(app);
modes.practice = new PracticeMode(app);
modes.read = new ReadMode(app);
modes.game = new GameMode(app);
modes.free = new FreeMode(app);
applySettings();
store.onChange(renderSummary);
const start = location.hash.slice(1);
setMode(modes[start] ? start : 'learn');
resize();
requestAnimationFrame(frame);
