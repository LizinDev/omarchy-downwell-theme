// The toolbar popup, drawn as the game's pause menu: the settings as rows,
// each with an upgrade's icon (dimmed while off) and the red arrow on the
// chosen one, a row that opens the shop, the theme's state, and in the corner
// today's gems (pages visited) as the game's HUD counts them.

import { loadArt, Sounds } from './lib/pixel.js';
import { OPTIONS, getSettings, setSetting, getStatus } from './lib/settings.js';

const SCALE = 2;
const W = 188;
const ROW = 14;
const TOP = 52;
const ROWS = OPTIONS.length + 1;   // the settings, then the shop
const SHOP = OPTIONS.length;
const STATUS = TOP + 8 + ROWS * ROW + 6;
const H = STATUS + 32;

const canvas = document.getElementById('screen');
const list = document.getElementById('options');
canvas.width = W;
canvas.height = H;
canvas.style.width = `${W * SCALE}px`;
canvas.style.height = `${H * SCALE}px`;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// The window is looked up now: the side panel opens only from a click or a
// key, and an await before chrome.sidePanel.open would lose that.
const [art, initial, win] = await Promise.all([loadArt(), getSettings(), chrome.windows.getCurrent()]);
const pal = art.palette;
document.documentElement.style.background = pal.background;
let settings = initial;
let status = await getStatus();
let chosen = 0;
let gems = null;
const sounds = new Sounds(settings.sound);

// today's pages, each one gem
async function countGems() {
  const own = chrome.runtime.getURL('');
  const pages = await chrome.history.search({
    text: '', startTime: new Date().setHours(0, 0, 0, 0), maxResults: 100000,
  }).catch(() => []);
  gems = pages.filter((p) => !p.url.startsWith(own)).length;
  draw();
}

chrome.runtime.sendMessage({ type: 'sync' }).then((s) => {
  if (s) {
    status = s;
    draw();
  }
}).catch(() => {});

// icon, then one or two lines of text
function statusLines() {
  const title = (status.title || art.theme.title).toUpperCase();
  switch (status.state) {
    case 'restart': return ['sprDeathIcons', ['RESTART CHROMIUM', 'fg'], ['chrome://restart', 'accent']];
    case 'policy': return ['sprLocked', ['COLOR POLICY ON', 'fg'], ['run tools/chromium-setup', 'accent']];
    case 'asleep': return [['sprPauseIcons', 2], ['ASLEEP', 'dim'], [status.theme || 'other theme', 'dim']];
    default: return ['sprHudLifeHeart', [`${title} ON`, 'fg']];
  }
}

function draw() {
  ctx.fillStyle = pal.background;
  ctx.fillRect(0, 0, W, H);
  art.sprite(ctx, 'sprTitleStroke', 0, W / 2, 22);
  art.sprite(ctx, 'sprTitle', 0, W / 2, 20);
  art.text(ctx, 'PAUSED', W / 2, 36, 'dim', { align: 'center' });
  if (settings.gems && gems !== null) {
    const tw = art.text(ctx, String(gems), W - 6, 4, 'fg', { align: 'right' });
    art.sprite(ctx, 'sprGemS', 0, W - 12 - tw, 8);
  }

  art.box(ctx, 4, TOP - 6, W - 8, ROWS * ROW + 12);
  for (let i = 0; i < ROWS; i++) {
    const y = TOP + 2 + i * ROW;
    const on = i === chosen;
    if (on) art.sprite(ctx, 'sprSelectArrow', 0, 12, y + 4);
    if (i === SHOP) {
      art.sprite(ctx, 'sUgMembersCard', 0, 26, y + 4);
      art.text(ctx, 'SHOP', 38, y, on ? 'accent' : 'fg');
      art.text(ctx, 'OPEN', W - 14, y, on ? 'accent' : 'dim', { align: 'right' });
      continue;
    }
    const [key, label, icon] = OPTIONS[i];
    art.sprite(ctx, settings[key] ? icon : `${icon}Off`, 0, 26, y + 4);
    art.text(ctx, label, 38, y, on ? 'accent' : 'fg');
    art.text(ctx, settings[key] ? 'ON' : 'OFF', W - 14, y, settings[key] ? 'accent' : 'dim', { align: 'right' });
  }

  const [icon, ...lines] = statusLines();
  const [name, frame] = Array.isArray(icon) ? icon : [icon, 0];
  const mid = STATUS + 14;
  art.sprite(ctx, name, frame, 20, mid);
  const top = mid - lines.length * 5;
  lines.forEach(([line, ink], i) => art.text(ctx, art.fit(line, W - 44), 36, top + i * 10, ink));
}

function describe() {
  const shop = document.createElement('li');
  const button = document.createElement('button');
  button.textContent = 'open the shop';
  button.addEventListener('click', openShop);
  shop.append(button);
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
  }), shop);
}

function openShop() {
  chrome.sidePanel.open({ windowId: win.id }).then(() => window.close(), () => {});
  sounds.play('pick', { volume: 0.4 });
}

async function pick(i) {
  if (i === SHOP) {
    openShop();
    return;
  }
  const [key] = OPTIONS[i];
  settings = await setSetting(key, !settings[key]);
  sounds.enabled = settings.sound;
  sounds.play(settings[key] ? 'pick' : 'back', { volume: 0.4 });
  describe();
  draw();
}

function move(to) {
  const next = (to + ROWS) % ROWS;
  if (next === chosen) return;
  chosen = next;
  sounds.play('move', { volume: 0.3 });
  draw();
}

canvas.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 's') move(chosen + 1);
  else if (e.key === 'ArrowUp' || e.key === 'w') move(chosen - 1);
  else if (['Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(e.key)) pick(chosen);
  else return;
  e.preventDefault();
});

function rowAt(e) {
  const y = e.offsetY / SCALE;
  const i = Math.floor((y - TOP + 2) / ROW);
  return i >= 0 && i < ROWS ? i : -1;
}

canvas.addEventListener('mousemove', (e) => {
  const i = rowAt(e);
  canvas.style.cursor = art.cursor(i >= 0 ? 'hand' : 'arrow', settings.cursors);
  if (i >= 0) move(i);
});
canvas.addEventListener('click', (e) => {
  const i = rowAt(e);
  if (i >= 0) pick(i);
});

describe();
draw();
canvas.focus();
countGems();
