// Draws the game's sprites and fonts from art/ (built by tools/chromium.py).
// Everything is drawn in art pixels on a small canvas that CSS scales up by a
// whole number, the way the game scales its 480x270 screen.

export async function loadArt() {
  const get = (path) => fetch(chrome.runtime.getURL(path), { cache: 'no-store' });
  const [atlas, theme, image] = await Promise.all([
    get('art/atlas.json').then((r) => r.json()),
    get('art/theme.json').then((r) => r.json()),
    get('art/atlas.png').then((r) => r.blob()).then((b) => createImageBitmap(b)),
  ]);
  return new Art(atlas, theme, image);
}

// typographic marks a font may lack, and what to draw instead
const PLAIN = {
  '—': '-', '–': '-', '‐': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '«': '"', '»': '"',
  '•': '*', '·': '.', '…': '.', '\u00a0': ' ',
};

export class Art {
  constructor(atlas, theme, image) {
    this.sprites = atlas.sprites;
    this.upgrades = atlas.upgrades;
    this.fonts = atlas.fonts;
    this.theme = theme;
    this.palette = theme.palette;
    this.image = image;
  }

  frames(name) {
    return this.sprites[name]?.length ?? 0;
  }

  // Draw frame `i` (wrapped) of a sprite with its origin at x, y.
  sprite(ctx, name, i, x, y, flip = false) {
    const frames = this.sprites[name];
    if (!frames) return;
    const [sx, sy, w, h, dx, dy] = frames[((Math.floor(i) % frames.length) + frames.length) % frames.length];
    x = Math.round(x);
    y = Math.round(y);
    if (flip) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      // mirrored about the origin column: offset u lands on -u
      ctx.drawImage(this.image, sx, sy, w, h, dx - 1, y + dy, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(this.image, sx, sy, w, h, x + dx, y + dy, w, h);
    }
  }

  // Draw a frame with the top left of its opaque pixels at x, y.
  place(ctx, name, i, x, y) {
    const [x0, y0] = this.bounds(name, i);
    this.sprite(ctx, name, i, x - x0, y - y0);
  }

  // Opaque extent of a frame relative to its origin: [x0, y0, x1, y1].
  bounds(name, i = 0) {
    const [, , w, h, dx, dy] = this.sprites[name][i];
    return [dx, dy, dx + w - 1, dy + h - 1];
  }

  // A CSS cursor: the theme's own (arrow, hand, text) when `on`, else the
  // system's.
  cursor(kind, on = true) {
    const fallback = { arrow: 'default', hand: 'pointer', text: 'text' }[kind];
    const c = on && this.theme.cursors?.[kind];
    return c ? `url("${chrome.runtime.getURL(c.file)}") ${c.hot[0]} ${c.hot[1]}, ${fallback}` : fallback;
  }

  // A character of a font, or its letter without the accent or its plain
  // ASCII stand-in (fontSmall is ASCII only), or '?'.
  glyph(ch, font = 'font0') {
    const chars = this.fonts[font].chars;
    return chars[ch] ?? chars[ch.normalize('NFD')[0]] ?? chars[PLAIN[ch]] ?? chars['?'];
  }

  measure(text, { scale = 1, font = 'font0' } = {}) {
    let w = 0;
    for (const ch of text) w += this.glyph(ch, font).shift;
    return w * scale;
  }

  // Text in one of the game's fonts: font0, or 'small' (fontSmall). `ink` is
  // one of fg, accent, dim, field.
  text(ctx, text, x, y, ink = 'fg', { align = 'left', scale = 1, font = 'font0' } = {}) {
    const width = this.measure(text, { scale, font });
    if (align === 'right') x -= width;
    else if (align === 'center') x -= Math.floor(width / 2);
    x = Math.round(x);
    y = Math.round(y);
    for (const ch of text) {
      const g = this.glyph(ch, font);
      const at = g.at[ink];
      if (at) ctx.drawImage(this.image, at[0], at[1], g.w, g.h, x + g.offset * scale, y, g.w * scale, g.h * scale);
      x += g.shift * scale;
    }
    return width;
  }

  // Cut text to fit `max` art pixels, ending in an ellipsis (three dots in a
  // font without one).
  fit(text, max, options = {}) {
    if (this.measure(text, options) <= max) return text;
    const more = this.fonts[options.font ?? 'font0'].chars['…'] ? '…' : '...';
    while (text && this.measure(text + more, options) > max) text = text.slice(0, -1);
    return text.trimEnd() + more;
  }

  // Break text into lines of at most `max` art pixels, at spaces where it can
  // (a URL breaks anywhere); at most `count` lines, the last one cut short.
  wrap(text, max, count, options = {}) {
    const lines = [];
    let rest = text.trim();
    while (rest && lines.length < count) {
      if (lines.length === count - 1 || this.measure(rest, options) <= max) {
        lines.push(this.fit(rest, max, options));
        break;
      }
      let end = 1;
      while (end < rest.length && this.measure(rest.slice(0, end + 1), options) <= max) end++;
      const space = rest.lastIndexOf(' ', end);
      if (space > end / 2) end = space;
      lines.push(rest.slice(0, end).trimEnd());
      rest = rest.slice(end).trimStart();
    }
    return lines;
  }

  // The game's text box (sprTextBox) stretched as a nine-slice: a white rim
  // with rounded corners over a red underline.
  box(ctx, x, y, w, h) {
    const [sx, sy, sw, sh] = this.sprites.sprTextBox[0];
    const c = 5;
    const cols = [[0, c, x, c], [c, sw - 2 * c, x + c, w - 2 * c], [sw - c, c, x + w - c, c]];
    const rows = [[0, c, y, c], [c, sh - 2 * c, y + c, h - 2 * c], [sh - c, c, y + h - c, c]];
    for (const [ox, ow, dx, dw] of cols) {
      for (const [oy, oh, dy, dh] of rows) {
        if (dw > 0 && dh > 0) ctx.drawImage(this.image, sx + ox, sy + oy, ow, oh, Math.round(dx), Math.round(dy), dw, dh);
      }
    }
  }
}

// Fit a canvas to its element at a whole-number scale. Returns the scale and
// the size in art pixels.
export function fitCanvas(canvas, scale) {
  const w = Math.ceil(canvas.clientWidth / scale);
  const h = Math.ceil(canvas.clientHeight / scale);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { ctx, w, h };
}

export class Sounds {
  constructor(enabled) {
    this.enabled = enabled;
    this.cache = new Map();
    this.last = new Map();
  }

  play(name, { gap = 60, volume = 0.5 } = {}) {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - (this.last.get(name) ?? -Infinity) < gap) return;
    this.last.set(name, now);
    let audio = this.cache.get(name);
    if (!audio) {
      audio = new Audio(chrome.runtime.getURL(`art/sounds/${name}.wav`));
      this.cache.set(name, audio);
    }
    const voice = audio.cloneNode();
    voice.volume = volume;
    voice.play().catch(() => {});
  }
}
