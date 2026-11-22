// Small sounds made on the fly with Web Audio, and letters read aloud.

let ctx = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type = 'sine', gain = 0.18) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sound = {
  enabled: true,
  /** Unlock audio on the first click (browsers block sound until then). */
  unlock() { audio(); },
  ok() { if (!this.enabled) return; tone(660, 0, 0.18, 'triangle'); tone(990, 0.07, 0.22, 'triangle'); },
  word() { if (!this.enabled) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.3, 'triangle', 0.15)); },
  pop() { if (!this.enabled) return; tone(880, 0, 0.1, 'sine', 0.2); tone(1320, 0.03, 0.08, 'sine', 0.1); },
  miss() { if (!this.enabled) return; tone(220, 0, 0.25, 'sawtooth', 0.06); tone(165, 0.08, 0.3, 'sawtooth', 0.05); },
  tick() { if (!this.enabled) return; tone(1200, 0, 0.04, 'square', 0.03); },
};

export function say(text) {
  if (!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}
