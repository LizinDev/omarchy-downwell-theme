// The new tab page, as the game's title screen: the opening backdrop with the
// logo and the hero falling in, a clock, a search box, and the most visited
// sites as a row of boxes like the game's upgrade choice. A still: it redraws
// only for the clock, the caret and the pointer.
// Keys: 1-8 open a shortcut, arrows and Enter choose one, / or typing searches.

import { loadArt, fitCanvas, Sounds } from './lib/pixel.js';
import { getSettings, getStatus } from './lib/settings.js';

// Asleep (the Omarchy theme has no Chromium build) but started awake: hand the
// tab to Chromium's own new tab page until the next start drops this one.
const state = await fetch('state.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
if (state && !state.active) {
  const tab = await chrome.tabs.getCurrent();
  await chrome.tabs.update(tab.id, { url: 'chrome://new-tab-page/' });
  await new Promise(() => {});
}

const canvas = document.getElementById('screen');
const search = document.getElementById('search');
const nav = document.getElementById('links');

const [art, settings, initialStatus] = await Promise.all([loadArt(), getSettings(), getStatus()]);
const pal = art.palette;
document.documentElement.style.background = pal.background;
const sounds = new Sounds(settings.sound);

let status = initialStatus;
function setStatus(next) {
  if (!next) return;
  status = next;
  draw();
}
chrome.storage.session.onChanged.addListener((changes) => changes.status && setStatus(changes.status.newValue));
// Ask the worker to look at the theme now, for the restart banner.
chrome.runtime.sendMessage({ type: 'sync' }).then(setStatus).catch(() => {});

// ---- shortcuts ----------------------------------------------------------

let shortcuts = [];
let chosen = -1;

// Repaint a favicon in the palette's three colors, as the game's palettes
// repaint its sprites: saturated pixels take the accent, light ones the ink,
// dark ones the field. An icon that would come out mostly field (a black logo)
// is flipped so it still shows on black.
function repaint(ctx) {
  const img = ctx.getImageData(0, 0, 16, 16);
  const d = img.data;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const ink = { field: hex(pal.background), fg: hex(pal.bright_foreground), accent: hex(pal.accent) };
  const roles = new Array(256).fill(null);
  const count = { field: 0, fg: 0, accent: 0 };
  for (let i = 0; i < 256; i++) {
    const [r, g, b, a] = d.subarray(i * 4, i * 4 + 4);
    if (a < 100) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const role = max > 90 && (max - min) / max > 0.45 ? 'accent' : lum > 110 ? 'fg' : 'field';
    roles[i] = role;
    count[role]++;
  }
  const flip = count.field > count.fg + count.accent;
  for (let i = 0; i < 256; i++) {
    let role = roles[i];
    if (!role) {
      d[i * 4 + 3] = 0;
      continue;
    }
    if (flip) role = role === 'field' ? 'fg' : role === 'fg' ? 'field' : role;
    d.set([...ink[role], 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
}

async function favicon(url) {
  const icon = new OffscreenCanvas(16, 16);
  const ctx = icon.getContext('2d');
  const img = new Image();
  img.src = `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(url)}&size=16`;
  try {
    await img.decode();
    ctx.drawImage(img, 0, 0, 16, 16);
    if (settings.favicons) repaint(ctx);
  } catch {
    art.sprite(ctx, 'sprGemS', 0, 8, 8);
  }
  return icon;
}

async function loadShortcuts() {
  const sites = (await chrome.topSites.get()).slice(0, 8);
  shortcuts = await Promise.all(sites.map(async (s) => ({
    url: s.url,
    title: s.title || new URL(s.url).hostname,
    icon: await favicon(s.url),
  })));
  nav.replaceChildren(...shortcuts.map((s, i) => {
    const a = document.createElement('a');
    a.href = s.url;
    a.textContent = `${i + 1}. ${s.title}`;
    return a;
  }));
  draw();
}

function open(i, background = false) {
  const s = shortcuts[i];
  if (!s) return;
  sounds.play('pick');
  if (background) chrome.tabs.create({ url: s.url, active: false });
  else location.href = s.url;
}

function choose(i) {
  if (i === chosen) return;
  chosen = i;
  if (i >= 0) sounds.play('move', { volume: 0.3 });
  draw();
}

// ---- layout -------------------------------------------------------------

// The backdrop (sprBgWell, origin 64,0) is 508 art pixels wide: take the
// whole-number scale at which it covers the width, unless that leaves too
// little height for the menu.
const BACKDROP = { w: 508, h: 286, center: 254, ox: 64 };
const SLOT = 28;
let scale = 4;
let view = null;

function layout() {
  scale = Math.max(2, Math.ceil(innerWidth / BACKDROP.w));
  if (innerHeight / scale < 160) scale = Math.max(2, Math.floor(innerHeight / 160));
  const { ctx, w, h } = fitCanvas(canvas, scale);
  const logo = h >= 170, date = h >= 130;
  const stack = (logo ? 38 : 0) + 24 + (date ? 18 : 0) + 30 + 40;
  const v = { ctx, w, h, logo, date, cx: Math.floor(w / 2) };
  // the stack sits in the open sky above the ledges
  let y = Math.max(6, Math.floor((h - 100 - stack) / 2));
  if (logo) {
    v.logoY = y + 16;
    y += 38;
  }
  v.clockY = y;
  y += 24;
  if (date) {
    v.dateY = y;
    y += 18;
  }
  const bw = Math.min(232, w - 24);
  v.search = { x: v.cx - Math.floor(bw / 2), y, w: bw, h: 20 };
  y += 30;
  v.rowY = y + 12;
  v.labelY = y + 26;
  view = v;
  Object.assign(search.style, {
    left: `${v.search.x * scale}px`, top: `${v.search.y * scale}px`,
    width: `${v.search.w * scale}px`, height: `${v.search.h * scale}px`,
  });
}

function slots() {
  const x0 = view.cx - Math.floor((shortcuts.length * SLOT) / 2);
  return shortcuts.map((s, i) => ({ s, i, x: x0 + i * SLOT, y: view.rowY - SLOT / 2 }));
}

// ---- drawing ------------------------------------------------------------

const lang = navigator.language;
function clock() {
  const now = new Date();
  const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', hour12: !settings.clock24 }).format(now);
  const date = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(now);
  return { time: time.toUpperCase(), date: date.toUpperCase() };
}

function searchBox(ctx, b) {
  art.box(ctx, b.x, b.y, b.w, b.h);
  art.text(ctx, '>', b.x + 6, b.y + 5, 'accent');
  const tx = b.x + 14, room = b.w - 22;
  const focused = document.activeElement === search;
  if (!search.value && !focused) {
    art.text(ctx, 'SEARCH', tx, b.y + 5, 'dim');
    return;
  }
  const caret = art.measure(search.value.slice(0, search.selectionStart ?? search.value.length));
  const shift = Math.max(0, caret - room);
  ctx.save();
  ctx.beginPath();
  ctx.rect(tx, b.y + 3, room + 2, 14);
  ctx.clip();
  art.text(ctx, search.value, tx - shift, b.y + 5, 'fg');
  if (focused && Math.floor(performance.now() / 500) % 2 === 0) {
    ctx.fillStyle = pal.accent;
    ctx.fillRect(tx - shift + caret, b.y + 5, 1, 9);
  }
  ctx.restore();
}

// The shortcuts in a row, the chosen one framed by the game's cursor corners
// and named underneath.
function row(ctx, v) {
  for (const { s, i, x, y } of slots()) {
    ctx.drawImage(s.icon, x + 6, y + 6);
    if (i === chosen) art.sprite(ctx, 'sprStCursor', 0, x + 14, y + 14);
  }
  const label = chosen >= 0
    ? [art.fit(shortcuts[chosen].title, v.w - 24), 'accent']
    : shortcuts.length ? [`1-${shortcuts.length}`, 'dim'] : null;
  if (label) art.text(ctx, label[0], v.cx, v.labelY, label[1], { align: 'center' });
}

function banner(ctx, v) {
  const name = (status.title || art.theme.title).toUpperCase();
  const lines = status.state === 'restart'
    ? [`RESTART CHROMIUM TO PUT ON ${name}`, 'chrome://restart']
    : status.state === 'policy'
      ? ["OMARCHY'S BROWSER COLOR POLICY IS ON", 'run tools/chromium-setup once']
      : null;
  if (!lines) return false;
  const w = Math.min(v.w - 8, Math.max(...lines.map((l) => art.measure(l))) + 24);
  const x = Math.floor((v.w - w) / 2), y = v.h - 40;
  art.box(ctx, x, y, w, 34);
  art.text(ctx, lines[0], v.cx, y + 7, 'fg', { align: 'center' });
  art.text(ctx, lines[1], v.cx, y + 18, 'accent', { align: 'center' });
  return true;
}

function draw() {
  const v = view;
  if (!v) return;
  const ctx = v.ctx;
  ctx.fillStyle = pal.background;
  ctx.fillRect(0, 0, v.w, v.h);
  // the title screen's ledges, bottom-aligned, and the hero dropping between them
  art.sprite(ctx, 'sprBgWell', 0, v.cx - BACKDROP.center + BACKDROP.ox, v.h - BACKDROP.h);
  if (!banner(ctx, v)) art.sprite(ctx, 'sprPlayerAir', 4, v.cx, v.h - 26);
  if (v.logo) {
    art.sprite(ctx, 'sprTitleStroke', 0, v.cx, v.logoY + 2);
    art.sprite(ctx, 'sprTitle', 0, v.cx, v.logoY);
  }
  const { time, date } = clock();
  art.text(ctx, time, v.cx, v.clockY, 'fg', { align: 'center', scale: 2 });
  if (v.date) art.text(ctx, date, v.cx, v.dateY, 'dim', { align: 'center' });
  searchBox(ctx, v.search);
  row(ctx, v);
}

layout();
draw();
loadShortcuts();
addEventListener('resize', () => {
  layout();
  draw();
});
// the clock, on the minute
setTimeout(function minute() {
  draw();
  setTimeout(minute, 60000 - (Date.now() % 60000));
}, 60000 - (Date.now() % 60000));
// the caret blinks while the search box has focus
let blink = 0;
search.addEventListener('focus', () => {
  draw();
  blink = setInterval(draw, 500);
});
search.addEventListener('blur', () => {
  clearInterval(blink);
  draw();
});
search.addEventListener('input', draw);
search.addEventListener('keyup', draw);

// ---- input --------------------------------------------------------------

addEventListener('keydown', (e) => {
  if (document.activeElement === search) {
    if (e.key === 'Enter') submit();
    else if (e.key === 'Escape') search.blur();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const n = shortcuts.length;
  if (/^[1-8]$/.test(e.key)) {
    open(Number(e.key) - 1, e.shiftKey);
  } else if (e.key === 'ArrowRight' && n) {
    choose((chosen + 1) % n);
  } else if (e.key === 'ArrowLeft' && n) {
    choose(chosen <= 0 ? n - 1 : chosen - 1);
  } else if (e.key === 'Enter' && chosen >= 0) {
    open(chosen, e.shiftKey);
  } else if (e.key === '/' || e.key.length === 1) {
    if (e.key === '/') e.preventDefault();
    search.focus();
    return;
  } else {
    return;
  }
  e.preventDefault();
});

function submit() {
  const text = search.value.trim();
  if (!text) return;
  sounds.play('pick');
  if (/^[a-z][\w+.-]*:\/\//i.test(text)) location.href = text;
  else if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(text)) location.href = `https://${text}`;
  else chrome.search.query({ text, disposition: 'CURRENT_TAB' });
}

function slotAt(e) {
  const x = e.clientX / scale, y = e.clientY / scale;
  return slots().findIndex((s) => x >= s.x && x < s.x + SLOT && y >= s.y && y < s.y + SLOT);
}

canvas.addEventListener('mousemove', (e) => {
  const i = slotAt(e);
  if (i >= 0) choose(i);
  canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
});

canvas.addEventListener('mousedown', (e) => {
  const i = slotAt(e);
  if (i < 0) return;
  e.preventDefault();
  open(i, e.button === 1 || e.ctrlKey || e.metaKey);
});
