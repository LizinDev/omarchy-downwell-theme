// The toolbar popup, drawn as the game's pause menu: the settings as rows
// with the red arrow on the chosen one, and the theme's state.

import { loadArt, Sounds } from './lib/pixel.js';
import { OPTIONS, getSettings, setSetting, getStatus } from './lib/settings.js';

const SCALE = 2;
const W = 160;
const ROW = 14;
const TOP = 52;
const H = TOP + 12 + OPTIONS.length * ROW + 26;

const canvas = document.getElementById('screen');
const list = document.getElementById('options');
canvas.width = W;
canvas.height = H;
canvas.style.width = `${W * SCALE}px`;
canvas.style.height = `${H * SCALE}px`;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const [art, initial] = await Promise.all([loadArt(), getSettings()]);
const pal = art.palette;
document.documentElement.style.background = pal.background;
let settings = initial;
let status = await getStatus();
let chosen = 0;
const sounds = new Sounds(settings.sound);

chrome.runtime.sendMessage({ type: 'sync' }).then((s) => {
  if (s) {
    status = s;
    draw();
  }
}).catch(() => {});

function statusLine() {
  const title = (status.title || art.theme.title).toUpperCase();
  switch (status.state) {
    case 'restart': return ['accent', 'RESTART: chrome://restart'];
    case 'policy': return ['accent', 'RUN tools/chromium-setup'];
    case 'asleep': return ['dim', `ASLEEP: ${status.theme || 'other theme'}`];
    default: return ['dim', `${title} ON`];
  }
}

function draw() {
  ctx.fillStyle = pal.background;
  ctx.fillRect(0, 0, W, H);
  art.sprite(ctx, 'sprTitleStroke', 0, W / 2, 22);
  art.sprite(ctx, 'sprTitle', 0, W / 2, 20);
  art.text(ctx, 'PAUSED', W / 2, 36, 'dim', { align: 'center' });

  art.box(ctx, 4, TOP - 6, W - 8, OPTIONS.length * ROW + 14);
  OPTIONS.forEach(([key, label], i) => {
    const y = TOP + 2 + i * ROW;
    const on = i === chosen;
    if (on) art.sprite(ctx, 'sprSelectArrow', 0, 14, y + 4);
    art.text(ctx, label, 22, y, on ? 'accent' : 'fg');
    art.text(ctx, settings[key] ? 'ON' : 'OFF', W - 14, y, settings[key] ? 'accent' : 'dim', { align: 'right' });
  });

  const y = TOP + 12 + OPTIONS.length * ROW + 4;
  const [ink, line] = statusLine();
  art.text(ctx, art.fit(line, W - 16), W / 2, y + 4, ink, { align: 'center' });
}

function describe() {
  list.replaceChildren(...OPTIONS.map(([key, label], i) => {
    const li = document.createElement('li');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = `opt-${key}`;
    box.checked = settings[key];
    box.addEventListener('change', () => toggle(i));
    const name = document.createElement('label');
    name.htmlFor = box.id;
    name.textContent = label.toLowerCase();
    li.append(box, name);
    return li;
  }));
}

async function toggle(i) {
  const [key] = OPTIONS[i];
  settings = await setSetting(key, !settings[key]);
  sounds.enabled = settings.sound;
  sounds.play(settings[key] ? 'pick' : 'back', { volume: 0.4 });
  describe();
  draw();
}

function move(to) {
  const next = (to + OPTIONS.length) % OPTIONS.length;
  if (next === chosen) return;
  chosen = next;
  sounds.play('move', { volume: 0.3 });
  draw();
}

canvas.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 's') move(chosen + 1);
  else if (e.key === 'ArrowUp' || e.key === 'w') move(chosen - 1);
  else if (['Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(e.key)) toggle(chosen);
  else return;
  e.preventDefault();
});

function rowAt(e) {
  const y = e.offsetY / SCALE;
  const i = Math.floor((y - TOP + 2) / ROW);
  return i >= 0 && i < OPTIONS.length ? i : -1;
}

canvas.addEventListener('mousemove', (e) => {
  const i = rowAt(e);
  canvas.style.cursor = i >= 0 ? 'pointer' : 'default';
  if (i >= 0) move(i);
});
canvas.addEventListener('click', (e) => {
  const i = rowAt(e);
  if (i >= 0) toggle(i);
});

describe();
draw();
canvas.focus();
