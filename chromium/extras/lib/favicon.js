// Site icons for the new tab page and the shop, from Chromium's favicon
// cache, optionally repainted in the palette.

// Repaint a favicon in the palette's three colors, as the game's palettes
// repaint its sprites: saturated pixels take the accent, light ones the ink,
// dark ones the field. An icon that would come out mostly field (a black logo)
// is flipped so it still shows on black.
function repaint(ctx, pal) {
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

// A 16 px icon for a page; a gem when Chromium has none to give.
export async function favicon(art, url, tint) {
  const icon = new OffscreenCanvas(16, 16);
  const ctx = icon.getContext('2d');
  const img = new Image();
  img.src = `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(url)}&size=16`;
  try {
    await img.decode();
    ctx.drawImage(img, 0, 0, 16, 16);
    if (tint) repaint(ctx, art.palette);
  } catch {
    art.sprite(ctx, 'sprGemS', 0, 8, 8);
  }
  return icon;
}
