// Small pieces shared by the modes.

/** Fills while a condition holds, and drains quickly when it stops. */
export class Hold {
  constructor() { this.v = 0; }
  update(ok, dt, seconds) {
    if (ok) this.v = Math.min(1, this.v + dt / Math.max(0.05, seconds));
    else this.v = Math.max(0, this.v - dt * 3);
    return this.v;
  }
  reset() { this.v = 0; }
  get done() { return this.v >= 1; }
}

export function setBar(el, v, done = false) {
  el.style.width = `${Math.round(v * 100)}%`;
  el.classList.toggle('done', done);
}

/** Set a feedback line: `kind` is '', 'ok' or 'near'; `soft` is extra text in a lighter style. */
export function feedback(el, text, kind = '', soft = '') {
  const html = `${escape(text)}${soft ? ` <span class="soft">${escape(soft)}</span>` : ''}`;
  if (el.innerHTML !== html) el.innerHTML = html;
  el.className = `feedback${kind ? ` ${kind}` : ''}`;
}

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function pick(list, avoid) {
  if (list.length < 2) return list[0];
  let w;
  do { w = list[Math.floor(Math.random() * list.length)]; } while (w === avoid);
  return w;
}
