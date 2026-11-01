// The side panel, as the game's shop: the sign, the shopkeeper behind his
// counter with the description box the shop shows for the item you look at,
// and three aisles of goods (bookmarks, history and downloads) on a shelf of
// rows, priced in gems where a price means something: a folder's size, a
// page's visits. A still, like the new tab page: it redraws only for input,
// the caret and the goods changing.
// Keys: left and right change aisle, up and down choose (Home, End, Page Up
// and Page Down jump), Enter opens (Shift: in a background tab, or shows a
// download in its folder), Backspace leaves a folder, / or typing searches
// the aisle and Enter there opens the first find.

import { loadArt, fitCanvas, Sounds } from './lib/pixel.js';
import { getSettings } from './lib/settings.js';
import { favicon } from './lib/favicon.js';

const SCALE = 2;
const ROW = 20;
const DESC = { y: 4, h: 42 };
const FLOOR = 49;
const AISLE_Y = 56;
const SEARCH_Y = 66;
const LIST_Y = 92;
const FOOT = 14;
const GAUGE = 8;
const AISLES = ['BOOKMARKS', 'HISTORY', 'DOWNLOADS'];
const DAY = 864e5;
const SMALL = { font: 'small' };

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

const bare = (url) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const lang = navigator.language;
const clock = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', hour12: !settings.clock24 });
const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' });

// A folder's icon: one of the upgrades, the same one for the same folder.
function upgrade(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return art.upgrades[h % art.upgrades.length];
}

function count(n, one, many) {
  return n ? `${n} ${n === 1 ? one : many}` : '';
}

const link = (n) => ({ kind: 'link', title: n.title || host(n.url), url: n.url, sub: bare(n.url) });
function shelf(n) {
  const kids = n.children ?? [];
  const links = kids.filter((k) => k.url).length;
  return {
    kind: 'folder', id: n.id, title: n.title || 'FOLDER', icon: upgrade(n.id),
    price: String(kids.length), gem: true,
    sub: [count(links, 'link', 'links'), count(kids.length - links, 'folder', 'folders')].filter(Boolean).join(', ') || 'empty',
  };
}

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
  const up = path.at(-2)?.title ?? 'bookmarks bar';
  return here ? [{ kind: 'back', title: 'BACK', sub: `to ${up}` }, ...rows] : rows;
}

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
    rows.push({
      kind: 'link', title: h.title || host(h.url), url: h.url, price: String(h.visitCount), gem: true,
      sub: `${clock.format(h.lastVisitTime)}  ${bare(h.url)}`,
    });
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
    const started = new Date(d.startTime);
    return {
      kind: 'download', id: d.id, title: d.filename.split('/').pop() || host(d.url), done,
      resume: d.state === 'interrupted' && d.canResume,
      icon: done ? 'sUgFengshui' : going ? 'sUgTime' : d.state === 'complete' ? 'sUgFengshuiOff' : 'sUgRIP',
      price: going
        ? d.totalBytes > 0 ? `${Math.floor((100 * d.bytesReceived) / d.totalBytes)}%` : size(d.bytesReceived)
        : done ? size(d.fileSize) : d.state === 'complete' ? 'GONE' : 'LOST',
      sub: `${date.format(started)} ${clock.format(started)}  ${host(d.finalUrl || d.url)}`,
      where: d.filename || d.url,
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
// moving. Refresh the aisle, keeping the place in it.
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
    desc: { x: 32, y: DESC.y, w: Math.max(40, w - 32 - 42), h: DESC.h },
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
// and between them the shop's description box: the chosen item in full, or
// the keeper's greeting. All on the shop's floor.
function shop(ctx, v) {
  art.place(ctx, 'sprShopSign', 0, 4, 10);
  const kx = v.w - 36;
  art.place(ctx, 'sprShopKeeper', 0, kx, 14);
  art.place(ctx, 'sprShopCounter', 0, kx + 6, 38);
  ctx.fillStyle = pal.foreground;
  ctx.fillRect(0, FLOOR, v.w, 1);

  const b = v.desc;
  art.box(ctx, b.x, b.y, b.w, b.h);
  const it = items[chosen];
  const room = b.w - 12;
  if (!it || it.kind === 'header') {
    art.text(ctx, 'WELCOME!', b.x + b.w / 2, b.y + 12, 'fg', { align: 'center' });
    art.text(ctx, art.fit(`${AISLES[aisle].toLowerCase()} aisle`, room, SMALL), b.x + b.w / 2, b.y + 26, 'dim', { align: 'center', ...SMALL });
    return;
  }
  const detail = it.kind === 'download' ? it.where : it.kind === 'link' ? it.url : it.sub;
  const lines = art.wrap(it.title, room, 2, SMALL);
  lines.forEach((line, i) => art.text(ctx, line, b.x + 6, b.y + 5 + i * 9, 'fg', SMALL));
  const rest = art.wrap(detail, room, 3 - lines.length, SMALL);
  rest.forEach((line, i) => art.text(ctx, line, b.x + 6, b.y + 5 + (lines.length + i) * 9, 'dim', SMALL));
}

function aisleBar(ctx, v) {
  const label = AISLES[aisle];
  const lw = art.measure(label);
  art.text(ctx, label, v.cx, AISLE_Y - 4, 'accent', { align: 'center' });
  art.place(ctx, 'sprShopArrowS', 3, v.cx - Math.ceil(lw / 2) - 10, AISLE_Y - 2);
  art.place(ctx, 'sprShopArrowS', 0, v.cx + Math.ceil(lw / 2) + 6, AISLE_Y - 2);
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

// Each item on two lines in the small font: its name, and under it in the
// dim ink where it leads (an address, a folder's contents, a download's day
// and site); the price on the right of the first.
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
      const tw = art.text(ctx, it.title, 8, y + 8, 'dim');
      ctx.fillStyle = pal.dark_foreground;
      ctx.fillRect(12 + tw, y + 12, Math.max(0, right - 12 - tw), 1);
      return;
    }
    const on = i === chosen;
    const mid = y + ROW / 2;
    if (on) art.sprite(ctx, 'sprSelectArrow', 0, 5, mid);
    if (it.kind === 'back') art.place(ctx, 'sprShopArrowS', 3, 16, mid - 3);
    else if (it.icon) art.sprite(ctx, it.icon, 0, 18, mid);
    else {
      const icon = icons.get(it.url);
      if (icon) ctx.drawImage(icon, 10, mid - 8);
      else art.sprite(ctx, 'sprGemS', 0, 18, mid);
    }
    let pw = 0;
    if (it.price) {
      pw = art.text(ctx, it.price, right, y + 3, on ? 'accent' : 'dim', { align: 'right', ...SMALL });
      if (it.gem) {
        art.sprite(ctx, 'sprGemS', 0, right - pw - 6, y + 6);
        pw += 11;
      }
      pw += 4;
    }
    const ink = on ? 'accent' : it.kind === 'download' && !it.done ? 'dim' : 'fg';
    art.text(ctx, art.fit(it.title, right - 30 - pw, SMALL), 30, y + 2, ink, SMALL);
    if (it.sub) art.text(ctx, art.fit(it.sub, right - 30, SMALL), 30, y + 11, 'dim', SMALL);
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
    a.textContent = it.kind === 'folder' ? `folder ${it.title}, ${it.sub}` : it.title;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      open(it, false);
    });
    return a;
  }));
}

// ---- input --------------------------------------------------------------

const pick = (i) => i >= 0 && i < items.length && items[i].kind !== 'header';

function choose(i) {
  if (i === chosen) return;
  chosen = i;
  if (i >= 0) sounds.play('move', { volume: 0.3 });
  draw();
}

// Step `step` rows from the chosen one (or from an end), on to the nearest
// item in that direction, stopping at the shelf's ends.
function move(step, from = chosen) {
  let i = Math.max(-1, Math.min(items.length, from + step));
  const dir = Math.sign(step) || 1;
  while (i >= 0 && i < items.length && !pick(i)) i += dir;
  if (!pick(i)) {
    i = Math.max(0, Math.min(items.length - 1, from + step));
    while (i >= 0 && i < items.length && !pick(i)) i -= dir;
  }
  if (!pick(i)) return;
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
    } else if (e.key === 'ArrowDown') {
      canvas.focus();
      move(1);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (!pick(chosen)) move(1, -1);
      if (pick(chosen)) open(items[chosen], e.shiftKey);
      e.preventDefault();
    }
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const page = Math.max(1, Math.floor(view.list.h / ROW) - 1);
  if (e.key === 'ArrowDown') move(1);
  else if (e.key === 'ArrowUp') move(-1);
  else if (e.key === 'PageDown') move(page);
  else if (e.key === 'PageUp') move(-page);
  else if (e.key === 'Home') move(1, -1);
  else if (e.key === 'End') move(-1, items.length);
  else if (e.key === 'ArrowLeft') switchAisle(-1);
  else if (e.key === 'ArrowRight') switchAisle(1);
  else if (e.key === 'Enter' && pick(chosen)) open(items[chosen], e.shiftKey);
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

// What the pointer is over: an item's index, 'left'/'right' on the aisle bar,
// or 'gauge' on the scrollbar.
function hit(e) {
  const x = e.offsetX / SCALE, y = e.offsetY / SCALE;
  if (y >= AISLE_Y - 6 && y < AISLE_Y + 8) return x < view.cx ? 'left' : 'right';
  const { y: top, h } = view.list;
  if (y < top || y >= top + h) return null;
  if (items.length * ROW > h && x >= view.w - GAUGE - 4) return 'gauge';
  const i = Math.floor((y - top + scroll) / ROW);
  return pick(i) ? i : null;
}

// Clicking or dragging on the gauge puts that part of the shelf in view.
function scrub(e) {
  const { y: top, h } = view.list;
  const at = Math.max(0, Math.min(1, (e.offsetY / SCALE - top) / h));
  scroll = at * (items.length * ROW - h);
  clampScroll();
  draw();
}

let scrubbing = false;
canvas.addEventListener('mousemove', (e) => {
  if (scrubbing) {
    scrub(e);
    return;
  }
  const at = hit(e);
  canvas.style.cursor = art.cursor(at === null ? 'arrow' : 'hand', settings.cursors);
  if (typeof at === 'number') choose(at);
});

canvas.addEventListener('mousedown', (e) => {
  const at = hit(e);
  if (at === null || e.button > 1) return;
  e.preventDefault();
  canvas.focus();
  if (at === 'gauge') {
    scrubbing = true;
    scrub(e);
  } else if (at === 'left' || at === 'right') switchAisle(at === 'left' ? -1 : 1);
  else open(items[at], e.button === 1 || e.ctrlKey || e.metaKey || e.shiftKey);
});
addEventListener('mouseup', () => (scrubbing = false));

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
