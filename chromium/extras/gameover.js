// The game's death screen, for a page that failed to load (the worker sends
// the tab here in place of Chromium's error page): the hero's grave, the
// results as the game lists them after a run (the area is the site, the style
// what went wrong), and the two ways on, retry and back. A still.
// Keys: Enter or R retries, Backspace or Escape goes back, left and right choose.
// A page lost to a dropped connection retries by itself when it comes back.

import { loadArt, fitCanvas, Sounds } from './lib/pixel.js';
import { getSettings } from './lib/settings.js';

const params = new URLSearchParams(location.search);
const url = params.get('url') ?? '';
const error = params.get('error') ?? '';
const canvas = document.getElementById('screen');
const said = document.getElementById('said');

const [art, settings] = await Promise.all([loadArt(), getSettings()]);
const pal = art.palette;
document.documentElement.style.background = pal.background;
const sounds = new Sounds(settings.sound);

let host = url;
try {
  host = new URL(url).host || url;
} catch {}
const style = error.replace(/^net::ERR_/, '').toLowerCase().replaceAll('_', ' ') || 'unknown';
const time = new Intl.DateTimeFormat(navigator.language, {
  hour: '2-digit', minute: '2-digit', hour12: !settings.clock24,
}).format(new Date());
document.title = `Game Over · ${host}`;
said.textContent = `Game over: ${host} did not load (${style}).`;

// sprResultStuff's frames: the labels of the game's results screen
const LABEL = { area: 2, time: 6, style: 7 };
// the ways on, with sprDeathIcons' frames: retry's circle, back's arrow
const CHOICES = [['RETRY', 0], ['BACK', 1]];
let chosen = 0;
let scale = 2;
let view = null;

function layout() {
  scale = Math.max(2, Math.min(Math.floor(innerWidth / 240), Math.floor(innerHeight / 200)));
  const { ctx, w, h } = fitCanvas(canvas, scale);
  const top = Math.max(4, Math.floor((h - 190) / 2));
  view = { ctx, w, h, cx: Math.floor(w / 2), top };
}

// where each choice is drawn, for drawing and for the pointer
function choices() {
  const { cx, top } = view;
  return CHOICES.map(([label, icon], i) => ({ label, icon, i, x: cx + (i ? 34 : -34), y: top + 154 }));
}

function draw() {
  const { ctx, w, h, cx, top } = view;
  ctx.fillStyle = pal.background;
  ctx.fillRect(0, 0, w, h);

  art.text(ctx, 'GAME OVER', cx, top, 'fg', { align: 'center', scale: 2 });
  art.sprite(ctx, 'sprGrave', 0, cx, top + 40);
  ctx.fillStyle = pal.foreground;
  ctx.fillRect(cx - 40, top + 50, 80, 1);

  // the results, labels on the left as the game draws them, values on the right
  const bw = Math.min(200, w - 16), bx = cx - Math.floor(bw / 2), by = top + 60;
  art.box(ctx, bx, by, bw, 50);
  const rows = [['area', host], ['time', time], ['style', style]];
  rows.forEach(([key, value], i) => {
    const y = by + 8 + i * 12;
    art.place(ctx, 'sprResultStuff', LABEL[key], bx + 8, y + 1);
    // a value too long for font0 tries the small font before being cut
    const room = bw - 52, text = value.toUpperCase();
    const font = art.measure(text) <= room ? 'font0' : 'small';
    art.text(ctx, art.fit(text, room, { font }), bx + bw - 8, y + (font === 'small' ? 1 : 0), i ? 'fg' : 'accent', { align: 'right', font });
  });
  art.text(ctx, art.fit(url, bw, { font: 'small' }), cx, by + 54, 'dim', { align: 'center', font: 'small' });

  for (const { label, icon, i, x, y } of choices()) {
    const on = i === chosen;
    art.sprite(ctx, 'sprDeathIcons', icon, x, y - 12);
    art.text(ctx, label, x, y + 6, on ? 'accent' : 'dim', { align: 'center' });
    if (on) art.sprite(ctx, 'sprSelectArrow', 0, x - Math.ceil(art.measure(label) / 2) - 6, y + 10);
  }
}

function choose(i) {
  if (i === chosen) return;
  chosen = i;
  sounds.play('move', { volume: 0.3 });
  draw();
}

// Tell the worker first, or it would take the same failure for a step back
// and let Chromium's page through.
async function again() {
  sounds.play('pick', { volume: 0.4 });
  await chrome.runtime.sendMessage({ type: 'retry', url }).catch(() => {});
  location.replace(url);
}

// Behind this page is the failed entry, which would only fail again.
function back() {
  sounds.play('back', { volume: 0.4 });
  if (history.length > 2) history.go(-2);
  else chrome.tabs.getCurrent().then((tab) => chrome.tabs.update(tab.id, { url: 'chrome://newtab/' }));
}

const act = (i) => (i === 0 ? again() : back());

addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') choose(chosen ? 0 : 1);
  else if (e.key === 'Enter' || e.key === ' ') act(chosen);
  else if (e.key === 'r' || e.key === 'R') again();
  else if (e.key === 'Backspace' || e.key === 'Escape') back();
  else return;
  e.preventDefault();
});

function choiceAt(e) {
  const x = e.clientX / scale, y = e.clientY / scale;
  return choices().findIndex((c) => Math.abs(x - c.x) < 24 && y > c.y - 28 && y < c.y + 18);
}

canvas.addEventListener('mousemove', (e) => {
  const i = choiceAt(e);
  canvas.style.cursor = art.cursor(i >= 0 ? 'hand' : 'arrow', settings.cursors);
  if (i >= 0) choose(i);
});
canvas.addEventListener('click', (e) => {
  const i = choiceAt(e);
  if (i >= 0) act(i);
});

if (error === 'net::ERR_INTERNET_DISCONNECTED') addEventListener('online', again);
addEventListener('resize', () => {
  layout();
  draw();
});
canvas.style.cursor = art.cursor('arrow', settings.cursors);
layout();
draw();
canvas.focus();
