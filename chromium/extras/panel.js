// The side panel, as the game's shop: the sign, the shopkeeper behind his
// counter, and three aisles of goods (bookmarks, history and downloads) on a
// shelf of rows, priced in gems where a price means something: a folder's
// size, a page's visits. A still, like the new tab page: it redraws only for
// input, the caret and the goods changing.
// Keys: left and right change aisle, up and down choose, Enter opens (Shift:
// in a background tab, or shows a download in its folder), Backspace leaves a
// folder, / or typing searches the aisle.

import { loadArt, fitCanvas, Sounds } from './lib/pixel.js';
import { getSettings } from './lib/settings.js';
import { favicon } from './lib/favicon.js';

const SCALE = 2;
const ROW = 18;
const AISLE_Y = 47;
const SEARCH_Y = 60;
const LIST_Y = 86;
const FOOT = 14;
const GAUGE = 8;
const AISLES = ['BOOKMARKS', 'HISTORY', 'DOWNLOADS'];
const DAY = 864e5;

const canvas = document.getElementById('screen');
const search = document.getElementById('search');
const nav = document.getElementById('items');

const [art, settings] = await Promise.all([loadArt(), getSettings()]);
const pal = art.palette;
document.documentElement.style.background = pal.background;
const sounds = new Sounds(settings.sound);

let aisle = 0;
try {
  aisle = Math.max(0, AISLES.indexOf(localStorage.getItem('aisle')));
} catch {}
let path = [];      // the bookmark folders entered, {id, title}
let items = [];
let chosen = -1;
let scroll = 0;     // art pixels
let view = null;
const icons = new Map();   // page url -> 16 px icon, while the panel is open

// ---- goods --------------------------------------------------------------

function host(url) {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

// A folder's icon: one of the upgrades, the same one for the same folder.
function upgrade(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return art.upgrades[h % art.upgrades.length];
}

const link = (n) => ({ kind: 'link', title: n.title || host(n.url), url: n.url });
const shelf = (n) => ({
  kind: 'folder', id: n.id, title: n.title || 'FOLDER', icon: upgrade(n.id),
  price: String(n.children?.length ?? 0), gem: true,
});

async function bookmarks(query) {
  if (query) return (await chrome.bookmarks.search(query)).filter((n) => n.url).slice(0, 200).map(link);
  const here = path.at(-1);
  let nodes;
  if (here) {
    const [node] = await chrome.bookmarks.getSubTree(here.id).catch(() => []);
    if (!node) {
      path = [];
      return bookmarks();
    }
    nodes = node.children ?? [];
  } else {
    // the bookmarks bar's contents, then the other top folders as folders
    const [root] = await chrome.bookmarks.getTree();
    const [bar, ...rest] = root.children;
    nodes = [...(bar.children ?? []), ...rest.filter((n) => n.children?.length)];
  }
  const rows = nodes.map((n) => (n.url ? link(n) : shelf(n)));
  return here ? [{ kind: 'back', title: 'BACK' }, ...rows] : rows;
}

const lang = navigator.language;
function dayName(time) {
  const days = Math.floor(new Date().setHours(24, 0, 0, 0) / DAY) - Math.floor(new Date(time).setHours(24, 0, 0, 0) / DAY);
  if (days === 0) return 'TODAY';
  if (days === 1) return 'YESTERDAY';
  return new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(time).toUpperCase();
}

// the last week, newest first, under a heading per day; a page costs its visits
async function history(query) {
  const found = await chrome.history.search({
    text: query, maxResults: 150, startTime: query ? 0 : Date.now() - 7 * DAY,
  });
  const rows = [];
  let day = '';
  const own = chrome.runtime.getURL('');
  for (const h of found) {
    if (h.url.startsWith(own)) continue;
    const name = dayName(h.lastVisitTime);
    if (name !== day) rows.push({ kind: 'header', title: (day = name) });
    rows.push({ kind: 'link', title: h.title || host(h.url), url: h.url, price: String(h.visitCount), gem: true });
  }
  return rows;
}

function size(bytes) {
  if (bytes < 0) return '';
  const units = ['B', 'K', 'M', 'G'];
  let i = 0;
  while (bytes >= 1000 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes < 10 && i ? bytes.toFixed(1) : Math.round(bytes)}${units[i]}`;
}

// what landed (the gem sack), what is still falling (the clock), what was lost
async function downloads(query) {
  const found = await chrome.downloads.search({
    ...(query ? { query: [query] } : {}), orderBy: ['-startTime'], limit: 100,
  });
  return found.map((d) => {
    const done = d.state === 'complete' && d.exists;
    const going = d.state === 'in_progress';
    return {
      kind: 'download', id: d.id, title: d.filename.split('/').pop() || host(d.url), done,
      resume: d.state === 'interrupted' && d.canResume,
      icon: done ? 'sUgFengshui' : going ? 'sUgTime' : d.state === 'complete' ? 'sUgFengshuiOff' : 'sUgRIP',
      price: going
        ? d.totalBytes > 0 ? `${Math.floor((100 * d.bytesReceived) / d.totalBytes)}%` : size(d.bytesReceived)
        : done ? size(d.fileSize) : d.state === 'complete' ? 'GONE' : 'LOST',
    };
  });
}

let ticket = 0;
async function reload(keep = false) {
  const mine = ++ticket;
  const rows = await [bookmarks, history, downloads][aisle](search.value.trim()).catch(() => []);
  if (mine !== ticket) return;
  items = rows;
  if (keep) {
    chosen = Math.min(chosen, items.length - 1);
  } else {
    chosen = -1;
    scroll = 0;
  }
  clampScroll();
  describe();
  draw();
  for (const it of items) {
    if (!it.url || icons.has(it.url)) continue;
    icons.set(it.url, null);
    favicon(art, it.url, settings.favicons).then((icon) => {
      icons.set(it.url, icon);
      redraw();
    });
  }
}

// Goods change under the panel: bookmarks edited, pages visited, downloads
// moving. Refresh the aisle on show, keeping the place in it.
let pending = 0;
function changed(which) {
  if (which !== aisle) return;
  clearTimeout(pending);
  pending = setTimeout(() => reload(true), 300);
}
for (const e of ['onCreated', 'onRemoved', 'onChanged', 'onMoved']) chrome.bookmarks[e].addListener(() => changed(0));
chrome.history.onVisited.addListener(() => changed(1));
chrome.history.onVisitRemoved.addListener(() => changed(1));
for (const e of ['onCreated', 'onChanged', 'onErased']) chrome.downloads[e].addListener(() => changed(2));

// ---- layout -------------------------------------------------------------

function layout() {
  const { ctx, w, h } = fitCanvas(canvas, SCALE);
  view = {
    ctx, w, h, cx: Math.floor(w / 2),
    search: { x: 6, y: SEARCH_Y, w: w - 12, h: 20 },
    list: { y: LIST_Y, h: Math.max(ROW, h - LIST_Y - FOOT) },
  };
  const b = view.search;
  Object.assign(search.style, {
    left: `${b.x * SCALE}px`, top: `${b.y * SCALE}px`, width: `${b.w * SCALE}px`, height: `${b.h * SCALE}px`,
  });
}

function clampScroll() {
  if (!view) return;
  scroll = Math.max(0, Math.min(scroll, items.length * ROW - view.list.h));
}

function reveal(i) {
  const top = i * ROW, { h } = view.list;
  if (top < scroll) scroll = top;
  else if (top + ROW > scroll + h) scroll = top + ROW - h;
}

// ---- drawing ------------------------------------------------------------

// The sign hanging on the left, the keeper behind his counter on the right,
// his greeting between them, all on the shop's floor.
function shop(ctx, v) {
  art.place(ctx, 'sprShopSign', 0, 6, 6);
  const kx = v.w - 38;
  art.place(ctx, 'sprShopKeeper', 0, kx, 10);
  art.place(ctx, 'sprShopCounter', 0, kx + 6, 31);
  art.sprite(ctx, 'sprShopMsg', 0, Math.floor((30 + kx) / 2), 22);
  ctx.fillStyle = pal.foreground;
  ctx.fillRect(0, 41, v.w, 1);
}

function aisleBar(ctx, v) {
  const label = AISLES[aisle];
  const lw = art.measure(label);
  art.text(ctx, label, v.cx, AISLE_Y - 3, 'accent', { align: 'center' });
  art.place(ctx, 'sprShopArrowS', 3, v.cx - Math.ceil(lw / 2) - 10, AISLE_Y - 1);
  art.place(ctx, 'sprShopArrowS', 0, v.cx + Math.ceil(lw / 2) + 6, AISLE_Y - 1);
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

// The ammo gauge, as the page scrollbars draw it: a rim with its corners cut,
// a gap, and the charge cut into rounds.
function gauge(ctx, x, y, h, at, size) {
  const w = GAUGE;
  ctx.fillStyle = pal.foreground;
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  const room = h - 4;
  const th = Math.max(12, Math.round(room * size));
  const ty = y + 2 + Math.round((room - th) * at);
  ctx.fillStyle = pal.accent;
  ctx.fillRect(x + 2, ty, w - 4, th);
  ctx.fillStyle = pal.background;
  for (let r = ty + 5; r < ty + th - 1; r += 6) ctx.fillRect(x + 2, r, w - 4, 1);
}

function shelfRows(ctx, v) {
  const { y: top, h } = v.list;
  const full = items.length * ROW;
  const right = v.w - (full > h ? GAUGE + 6 : 6);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, v.w, h);
  ctx.clip();
  items.forEach((it, i) => {
    const y = top + i * ROW - scroll;
    if (y + ROW <= top || y >= top + h) return;
    if (it.kind === 'header') {
      const tw = art.text(ctx, it.title, 8, y + 6, 'dim');
      ctx.fillStyle = pal.dark_foreground;
      ctx.fillRect(12 + tw, y + 10, Math.max(0, right - 12 - tw), 1);
      return;
    }
    const on = i === chosen;
    if (on) art.sprite(ctx, 'sprSelectArrow', 0, 5, y + ROW / 2);
    if (it.kind === 'back') art.place(ctx, 'sprShopArrowS', 3, 16, y + 6);
    else if (it.icon) art.sprite(ctx, it.icon, 0, 18, y + ROW / 2);
    else {
      const icon = icons.get(it.url);
      if (icon) ctx.drawImage(icon, 10, y + 1);
      else art.sprite(ctx, 'sprGemS', 0, 18, y + ROW / 2);
    }
    let pw = 0;
    if (it.price) {
      pw = art.text(ctx, it.price, right, y + 4, on ? 'accent' : 'dim', { align: 'right' });
      if (it.gem) {
        art.sprite(ctx, 'sprGemS', 0, right - pw - 6, y + ROW / 2);
        pw += 11;
      }
      pw += 6;
    }
    const ink = on ? 'accent' : it.kind === 'download' && !it.done ? 'dim' : 'fg';
    art.text(ctx, art.fit(it.title, right - 30 - pw), 30, y + 4, ink);
  });
  ctx.restore();
  if (!items.length) {
    art.text(ctx, search.value.trim() ? 'NOTHING LIKE THAT' : 'SOLD OUT!', v.cx, top + 12, 'dim', { align: 'center' });
  }
  if (full > h) gauge(ctx, v.w - GAUGE - 2, top, h, scroll / (full - h), h / full);
}

function footer(ctx, v) {
  const goods = items.filter((it) => it.kind !== 'header' && it.kind !== 'back').length;
  let line;
  if (search.value.trim()) line = `${goods} FOUND`;
  else if (aisle === 0) line = path.length ? path.map((p) => p.title).join(' / ') : 'BOOKMARKS BAR';
  else line = `${goods} ${aisle === 1 ? 'PAGES THIS WEEK' : 'DOWNLOADS'}`;
  ctx.fillStyle = pal.foreground;
  ctx.fillRect(0, v.h - FOOT, v.w, 1);
  art.text(ctx, art.fit(line.toUpperCase(), v.w - 12), 6, v.h - FOOT + 3, 'dim');
}

function draw() {
  const v = view;
  if (!v) return;
  const ctx = v.ctx;
  ctx.fillStyle = pal.background;
  ctx.fillRect(0, 0, v.w, v.h);
  shop(ctx, v);
  aisleBar(ctx, v);
  searchBox(ctx, v.search);
  shelfRows(ctx, v);
  footer(ctx, v);
}

let frame = 0;
function redraw() {
  if (!frame) frame = requestAnimationFrame(() => {
    frame = 0;
    draw();
  });
}

// The items again as links and buttons, for screen readers.
function describe() {
  nav.replaceChildren(...items.filter((it) => it.kind !== 'header').map((it) => {
    const a = document.createElement('a');
    a.href = it.url ?? '#';
    a.textContent = it.kind === 'folder' ? `folder ${it.title}, ${it.price} items` : it.title;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      open(it, false);
    });
    return a;
  }));
}

// ---- input --------------------------------------------------------------

function choose(i) {
  if (i === chosen) return;
  chosen = i;
  if (i >= 0) sounds.play('move', { volume: 0.3 });
  draw();
}

function move(step) {
  let i = chosen;
  do i += step; while (i >= 0 && i < items.length && items[i].kind === 'header');
  if (i < 0 || i >= items.length) return;
  reveal(i);
  choose(i);
  draw();
}

function switchAisle(step) {
  aisle = (aisle + step + AISLES.length) % AISLES.length;
  try {
    localStorage.setItem('aisle', AISLES[aisle]);
  } catch {}
  path = [];
  search.value = '';
  sounds.play('move', { volume: 0.3 });
  reload();
}

function back() {
  if (!path.length || search.value) return;
  path.pop();
  sounds.play('back', { volume: 0.4 });
  reload();
}

function open(it, aside) {
  switch (it.kind) {
    case 'back':
      back();
      return;
    case 'folder':
      path.push({ id: it.id, title: it.title });
      search.value = '';
      sounds.play('pick', { volume: 0.4 });
      reload();
      return;
    case 'link':
      sounds.play('pick', { volume: 0.4 });
      if (aside) chrome.tabs.create({ url: it.url, active: false });
      else chrome.tabs.update({ url: it.url });
      return;
    case 'download':
      if (it.done) {
        sounds.play('pick', { volume: 0.4 });
        if (aside) chrome.downloads.show(it.id);
        else chrome.downloads.open(it.id);
      } else if (it.resume) {
        sounds.play('pick', { volume: 0.4 });
        chrome.downloads.resume(it.id);
      }
  }
}

addEventListener('keydown', (e) => {
  if (document.activeElement === search) {
    if (e.key === 'Escape') {
      if (search.value) {
        search.value = '';
        reload();
      } else canvas.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      canvas.focus();
      if (e.key === 'Enter' && chosen < 0) move(1);
      else if (e.key === 'Enter') open(items[chosen], e.shiftKey);
      else move(1);
      e.preventDefault();
    }
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'ArrowDown') move(1);
  else if (e.key === 'ArrowUp') move(-1);
  else if (e.key === 'ArrowLeft') switchAisle(-1);
  else if (e.key === 'ArrowRight') switchAisle(1);
  else if (e.key === 'Enter' && chosen >= 0) open(items[chosen], e.shiftKey);
  else if (e.key === 'Backspace') back();
  else if (e.key === '/' || e.key.length === 1) {
    if (e.key === '/') e.preventDefault();
    search.focus();
    return;
  } else return;
  e.preventDefault();
});

let typing = 0;
search.addEventListener('input', () => {
  draw();
  clearTimeout(typing);
  typing = setTimeout(() => reload(), 150);
});
search.addEventListener('keyup', draw);
let blink = 0;
search.addEventListener('focus', () => {
  draw();
  blink = setInterval(draw, 500);
});
search.addEventListener('blur', () => {
  clearInterval(blink);
  draw();
});

// what the pointer is over: an item's index, 'left'/'right' on the aisle bar
function hit(e) {
  const x = e.offsetX / SCALE, y = e.offsetY / SCALE;
  if (y >= AISLE_Y - 6 && y < AISLE_Y + 8) return x < view.cx ? 'left' : 'right';
  const { y: top, h } = view.list;
  if (y < top || y >= top + h) return null;
  const i = Math.floor((y - top + scroll) / ROW);
  return i < items.length && items[i].kind !== 'header' ? i : null;
}

canvas.addEventListener('mousemove', (e) => {
  const at = hit(e);
  canvas.style.cursor = art.cursor(at === null ? 'arrow' : 'hand', settings.cursors);
  if (typeof at === 'number') choose(at);
});

canvas.addEventListener('mousedown', (e) => {
  const at = hit(e);
  if (at === null || e.button > 1) return;
  e.preventDefault();
  canvas.focus();
  if (at === 'left' || at === 'right') switchAisle(at === 'left' ? -1 : 1);
  else open(items[at], e.button === 1 || e.ctrlKey || e.metaKey || e.shiftKey);
});

canvas.addEventListener('wheel', (e) => {
  scroll += e.deltaMode ? Math.sign(e.deltaY) * ROW * 3 : e.deltaY / SCALE;
  clampScroll();
  draw();
}, { passive: true });

addEventListener('resize', () => {
  layout();
  clampScroll();
  draw();
});

canvas.style.cursor = art.cursor('arrow', settings.cursors);
search.style.cursor = art.cursor('text', settings.cursors);
layout();
draw();
reload();
canvas.focus();
