"""Compose Downwell-style wallpapers from the installed game's original sprites.

Reads the user's own Steam copy read-only (via the Downwell project's
tools/game_sprites.py), remaps the sprites' black/white/red roles onto this
theme's palette (palette.py) and writes 1920x1080 PNGs at an integer pixel scale.
"""
import sys
import numpy as np
from pathlib import Path

sys.path.append(str(Path.home() / 'Projects/Downwell/tools'))
from game_sprites import GameSprites, write_png  # noqa: E402
from palette import BG, FG, ACCENT  # noqa: E402,F401

g = GameSprites()
_cache = {}


def frame(name, i=0):
    key = (name, i)
    if key not in _cache:
        f = g.frames(name)[i]
        px = np.frombuffer(bytes(f['pixels']), np.uint8).reshape(f['h'], f['w'], 4).copy()
        out = np.zeros_like(px)
        on = px[..., 3] > 0
        red = on & (px[..., 0] > 128) & (px[..., 1] < 128)
        white = on & (px[..., 0] > 128) & (px[..., 1] > 128)
        black = on & ~red & ~white
        out[black] = (*BG, 255)
        out[white] = (*FG, 255)
        out[red] = (*ACCENT, 255)
        _cache[key] = (out, f['origin'])
    return _cache[key]


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = np.zeros((h, w, 3), np.uint8)
        self.px[:] = BG

    def blit(self, name, x, y, i=0, flip=False, rot=0, vflip=False):
        img, (ox, oy) = frame(name, i)
        h, w = img.shape[:2]
        if flip:
            img = img[:, ::-1]
            ox = w - 1 - ox
        if vflip:
            img = img[::-1]
            oy = h - 1 - oy
        for _ in range(rot % 4):  # quarter turns clockwise about the origin
            img = np.rot90(img, -1)
            h, w = w, h
            ox, oy = w - 1 - oy, ox
        self.paste(img, int(x) - ox, int(y) - oy)

    def paste(self, img, x0, y0):
        h, w = img.shape[:2]
        sx0, sy0 = max(0, -x0), max(0, -y0)
        sx1, sy1 = min(w, self.w - x0), min(h, self.h - y0)
        if sx1 <= sx0 or sy1 <= sy0:
            return
        src = img[sy0:sy1, sx0:sx1]
        dst = self.px[y0 + sy0:y0 + sy1, x0 + sx0:x0 + sx1]
        mask = src[..., 3] > 0
        dst[mask] = src[..., :3][mask]

    def save(self, path, scale):
        big = self.px.repeat(scale, 0).repeat(scale, 1)
        h, w = big.shape[:2]
        rgba = np.concatenate([big, np.full((h, w, 1), 255, np.uint8)], 2)
        write_png(path, w, h, rgba.tobytes())


def tiles(c, solid, sheet='sprTile1', ox=0, oy=0, special=None):
    """Draw a 16px solid-cell grid the way objWall_n does: 4-neighbour bitmask
    frame plus light corners on enclosed cells. `solid(col,row)` may report
    cells outside the drawn area so wall faces read correctly."""
    special = special or {}
    rows, cols = (c.h + 15) // 16 + 1, (c.w + 15) // 16 + 1
    corners = [(25, -1, -1), (24, 1, -1), (21, -1, 1), (20, 1, 1)]
    for r in range(-1, rows):
        for q in range(-1, cols):
            if not solid(q, r) or solid(q, r) == 'hidden':
                continue
            x, y = ox + q * 16 + 8, oy + r * 16 + 8
            if (q, r) in special:
                c.blit(sheet, x, y, special[(q, r)])
                continue
            idx = (1 if solid(q, r - 1) else 0) + (2 if solid(q + 1, r) else 0) + \
                  (4 if solid(q, r + 1) else 0) + (8 if solid(q - 1, r) else 0)
            c.blit(sheet, x, y, idx)
            if idx == 15:
                for f, dq, dr in corners:
                    if not solid(q + dq, r + dr):
                        c.blit(sheet, x, y, f)


_fonts = {}


def glyphs(font):
    if font not in _fonts:
        _fonts[font] = g.font(font)
    return _fonts[font]


def text(c, s, x, y, color=FG, font='font0', shadow=None, align='left'):
    """Game-font text with its top-left at x, y; `shadow` draws the copy one
    pixel lower first, the way Downwell's titles carry a red under-stroke."""
    gl = glyphs(font)
    width = sum(gl[ch]['shift'] for ch in s if ch in gl)
    if align == 'right':
        x -= width
    elif align == 'center':
        x -= width // 2
    for col, dy in ([(shadow, 1)] if shadow else []) + [(color, 0)]:
        cx = x
        for ch in s:
            if ch not in gl:
                continue
            gph = gl[ch]
            if gph['w'] and gph['h']:
                px = np.frombuffer(bytes(gph['pixels']), np.uint8).reshape(gph['h'], gph['w'], 4)
                img = np.zeros_like(px)
                on = px[..., 3] > 0
                bright = on & (px[..., 0] > 128)
                img[bright] = (*col, 255)
                img[on & ~bright] = (*BG, 255)
                c.paste(img, cx + gph['offset'], y + dy)
            cx += gph['shift']
    return width
