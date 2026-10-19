"""Build chromium/: a Chromium theme extension and the art of its companion
extension, from colors.toml and the installed game's sprites.

    python3 -I tools/chromium.py

chromium/theme   the theme: colors from colors.toml, the well's rim along the
                 tab strip, a red edge on the selected tab, and the title
                 backdrop on Chromium's own new tab page
chromium/extras  the companion (title-screen new tab page, popup, page tint);
                 this writes only its art/, the code is checked in

Downwell's art is not ours to publish, so everything this writes is gitignored.
Omarchy stages chromium/ with the rest of the theme, and the theme-set hook
(tools/chromium-hook) installs it into the browser from there.
"""
import json
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, sys.argv[0].rsplit('/', 1)[0])
from palette import KEYS, BG, FG, ACCENT  # noqa: E402
from compose import Canvas, frame, bbox, glyphs, write_png  # noqa: E402

THEME = Path(__file__).resolve().parent.parent
OUT = THEME / 'chromium'
NAME = THEME.name.removeprefix('omarchy-').removesuffix('-theme')   # downwell, downwell-nikaido
TITLE = ' '.join(w.capitalize() for w in NAME.split('-'))
# Unpacked extension versions are up to four integers below 65536. The minute
# stamp lets the companion tell a rebuilt theme from the one Chromium loaded.
STAMP = int(time.time() // 60)
VERSION = f'1.{STAMP // 65536}.{STAMP % 65536}'

# Measured on Chromium 154 with striped probe images: theme_frame and
# theme_toolbar are both painted from 16 px above the window (the hidden title
# bar of its custom frame), and a tab's top edge sits 6 px below the window
# top, tiled in Hyprland or floating alike.
HIDDEN = 16
TAB_TOP = 6
SCALE = 2


def png(path, px, scale=1):
    big = px.repeat(scale, 0).repeat(scale, 1)
    h, w = big.shape[:2]
    if big.shape[2] == 3:
        big = np.concatenate([big, np.full((h, w, 1), 255, np.uint8)], 2)
    path.parent.mkdir(parents=True, exist_ok=True)
    write_png(path, w, h, big.tobytes())


def solid(color, w=16, h=16):
    px = np.empty((h, w, 3), np.uint8)
    px[:] = color
    return px


def rim(field, width=1024, height=40, seed=11):
    """The well's rim seen from below, in art pixels (drawn at 2x): a ragged
    white edge just under the hidden title bar, and a few of the well's
    residents hanging from it. They sit far apart and start well to the right,
    so they live in the empty strip past the tabs; inactive tabs get a solid
    background so the ones behind them never show through a title."""
    rng = np.random.default_rng(seed)
    c = Canvas(width, height)
    top = HIDDEN // SCALE
    depth = np.convolve(rng.normal(1.6, 1.0, width + 8), np.ones(5) / 5, 'same')[4:width + 4]
    depth = np.clip(np.round(depth), 1, 3).astype(int)
    for x in range(width):
        c.px[:top + depth[x], x] = FG
        if rng.random() < 0.05:  # drips
            c.px[top + depth[x]:top + depth[x] + rng.integers(1, 3), x] = FG
    # the speckled holes of the game's rubble tiles
    holes = (rng.random((height, width)) < 0.22) & (np.arange(height)[:, None] <= top)
    c.px[holes & (c.px == FG).all(-1)] = BG

    cast = ['sprBatHang', 'sprSpiderHang', 'sprBatHang', 'gem', 'sprSpiderHang']
    x, i = 330, 0
    while x < width - 24:
        name = cast[i % len(cast)]
        if name == 'sprBatHang':
            f = int(rng.integers(0, 4))
            c.blit(name, x, top + 1 - bbox(name, f)[1], f)
        elif name == 'sprSpiderHang':
            drop = int(rng.integers(2, 6))
            c.px[top:top + 3 + drop, x] = FG   # the thread
            c.blit(name, x, top + 3 + drop - bbox(name)[1], 0)
        else:  # a gem stuck in the rock, as the game's gem blocks show them
            c.blit('sprGemS', x, top + 2, 0)
        x += int(rng.integers(140, 240))
        i += 1
    out = c.px.copy()
    out[(out == BG).all(-1)] = field
    return out


def toolbar(color, edge, width=16, height=600):
    """Solid toolbar with an accent edge on the rows a tab's top edge lands on.
    Chromium paints the selected tab and the toolbar from this one image, and
    those rows lie above the toolbar, so only the selected tab gets the edge:
    the game's red underline, turned into the marker of the chosen tab. Tall,
    because the image tiles vertically under the bookmarks bar too."""
    px = solid(color, width, height)
    px[HIDDEN + TAB_TOP:HIDDEN + TAB_TOP + 2] = edge
    return px


def ntp_backdrop():
    """The title screen's opening backdrop with the hero falling into it, for
    Chromium's own new tab page (shown when the companion's page is off)."""
    c = Canvas(480, 270)
    img, _ = frame('sprBgWell')
    c.paste(img[8:278, 14:494], 0, 0)
    c.blit('sprPlayerAir', 240, 186, 4)
    return c.px


def build_theme():
    k = KEYS
    dest = OUT / 'theme'
    png(dest / 'images/frame.png', rim(k['darker_background']), SCALE)
    png(dest / 'images/toolbar.png', toolbar(k['background'], ACCENT))
    png(dest / 'images/tab.png', solid(k['darker_background']))
    png(dest / 'images/ntp.png', ntp_backdrop(), 4)
    images = {
        'theme_frame': 'images/frame.png',
        'theme_frame_inactive': 'images/frame.png',
        'theme_toolbar': 'images/toolbar.png',
        'theme_tab_background': 'images/tab.png',
        'theme_tab_background_inactive': 'images/tab.png',
        'theme_ntp_background': 'images/ntp.png',
    }
    colors = {
        'frame': k['darker_background'],
        'frame_inactive': k['darker_background'],
        'background_tab': k['darker_background'],
        'background_tab_inactive': k['darker_background'],
        'toolbar': k['background'],
        'toolbar_text': k['foreground'],
        'toolbar_button_icon': k['bright_foreground'],
        'tab_text': k['bright_foreground'],
        'tab_background_text': k['dark_foreground'],
        'tab_background_text_inactive': k['muted'],
        'bookmark_text': k['foreground'],
        'omnibox_background': k['lighter_background'],
        'omnibox_text': k['bright_foreground'],
        'ntp_background': k['background'],
        'ntp_text': k['foreground'],
        'ntp_link': ACCENT,
        'ntp_header': ACCENT,
    }
    manifest = {
        'manifest_version': 3,
        'name': TITLE,
        'description': f'The {TITLE} Omarchy theme, for Chromium.',
        'version': VERSION,
        'theme': {
            'images': images,
            'colors': {key: list(v) for key, v in colors.items()},
            # Chromium lightens an unfocused window's frame image by default;
            # the game does not fade, so keep it as drawn.
            'tints': {'frame_inactive': [-1, -1, 0.5]},
            'properties': {'ntp_background_alignment': 'bottom', 'ntp_background_repeat': 'no-repeat'},
        },
    }
    (dest / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


# The companion's sprites: name -> (frames, quarter turns clockwise).
SPRITES = {
    'sprBgWell': 1, 'sprTitle': 1, 'sprPlayerAir': 5, 'sprGemS': 1,
    'sprTextBox': 1, 'sprSelectArrow': 1, 'sprStCursor': 1,
}
# Latin-1 and the two punctuation marks the game's font adds; enough for
# Portuguese dates and most page titles. Anything else falls back to '?'.
CHARS = [chr(c) for c in range(32, 127)] + [chr(c) for c in range(160, 256)] + ['–', '…']
SOUNDS = {'move': 'sfxShopScroll', 'pick': 'sfxUiMenu_Select_Confirm', 'back': 'sfxShopBack'}
GAME = Path.home() / 'Projects/Downwell'


class Atlas:
    """Shelf-packed sprite sheet. Frames are cropped to their opaque pixels and
    remember where that crop sits relative to the sprite's origin."""

    def __init__(self, width=1024):
        self.w, self.x, self.y, self.row = width, 0, 0, 0
        self.parts = []

    def add(self, img):
        h, w = img.shape[:2]
        if self.x + w > self.w:
            self.x, self.y, self.row = 0, self.y + self.row + 1, 0
        at = (self.x, self.y)
        self.parts.append((at, img))
        self.x += w + 1
        self.row = max(self.row, h)
        return at

    def image(self):
        h = self.y + self.row + 1
        px = np.zeros((h, self.w, 4), np.uint8)
        for (x, y), img in self.parts:
            px[y:y + img.shape[0], x:x + img.shape[1]] = img
        return px


def crop(img):
    ys, xs = np.nonzero(img[..., 3])
    if not len(ys):
        return img[:1, :1], 0, 0
    return img[ys.min():ys.max() + 1, xs.min():xs.max() + 1], xs.min(), ys.min()


def turn(img, ox, oy, quarters):
    for _ in range(quarters % 4):
        img = np.rot90(img, -1)
        ox, oy = img.shape[1] - 1 - oy, ox
    return img, ox, oy


def build_art():
    k = KEYS
    dest = OUT / 'extras/art'
    atlas = Atlas()
    sprites = {}
    for name, spec in SPRITES.items():
        count, quarters = spec if isinstance(spec, tuple) else (spec, 0)
        frames = []
        for i in range(count):
            img, (ox, oy) = frame(name, i)
            img, ox, oy = turn(img, ox, oy, quarters)
            part, dx, dy = crop(img)
            x, y = atlas.add(part)
            frames.append([int(x), int(y), part.shape[1], part.shape[0], int(dx - ox), int(dy - oy)])
        sprites[name] = frames

    # The logo's under-stroke, as tools/title.py draws it: its white in the accent.
    img, (ox, oy) = frame('sprTitle')
    white = (img[..., 3] > 0) & (img[..., 0] > 128) & (img[..., 1] > 128)
    stroke = np.zeros_like(img)
    stroke[white] = (*ACCENT, 255)
    part, dx, dy = crop(stroke)
    x, y = atlas.add(part)
    sprites['sprTitleStroke'] = [[int(x), int(y), part.shape[1], part.shape[0], int(dx - ox), int(dy - oy)]]

    # The game's font, baked in each color the pages use: its glyphs are a
    # bright core and a dark rim, which keeps the field color.
    font = glyphs('font0')
    inks = {'fg': FG, 'accent': ACCENT, 'dim': k['dark_foreground'], 'field': k['darker_background']}
    chars = {}
    for ch in CHARS:
        gl = font.get(ch)
        if gl is None:
            continue
        entry = {'shift': gl['shift'], 'offset': gl['offset'], 'w': gl['w'], 'h': gl['h'], 'at': {}}
        if gl['w'] and gl['h']:
            px = np.frombuffer(bytes(gl['pixels']), np.uint8).reshape(gl['h'], gl['w'], 4)
            on = px[..., 3] > 0
            bright = on & (px[..., 0] > 128)
            for ink, color in inks.items():
                img = np.zeros_like(px)
                img[bright] = (*color, 255)
                img[on & ~bright] = (*k['darker_background'], 255)
                entry['at'][ink] = list(map(int, atlas.add(img)))
        chars[ch] = entry

    sheet = atlas.image()
    png(dest / 'atlas.png', sheet)
    palette = {key: '#%02x%02x%02x' % tuple(v) for key, v in k.items() if key != 'mode'}
    (dest / 'atlas.json').write_text(json.dumps({
        'sprites': sprites,
        'font': {'height': 10, 'chars': chars},
    }, separators=(',', ':')))
    (dest / 'theme.json').write_text(json.dumps({
        'name': NAME, 'title': TITLE, 'built': VERSION, 'palette': palette,
        'tints': {part: f'art/tint-{NAME}-{part}.css' for part in ('scrollbars', 'selection')},
    }, indent=2) + '\n')

    # toolbar and extension icons: the gem, as large as fits on a whole scale
    for size in (16, 32, 48, 128):
        best = None
        for name in ('sprGemS', 'sprGemM', 'sprGemL'):
            img, _ = frame(name, 0)
            part, _, _ = crop(img)
            s = (size - 2) // max(part.shape[:2])
            if s >= 1 and (best is None or part.shape[0] * s > best[0].shape[0] * best[1]):
                best = (part, s)
        part, s = best
        big = part.repeat(s, 0).repeat(s, 1)
        icon = np.zeros((size, size, 4), np.uint8)
        y0, x0 = (size - big.shape[0]) // 2, (size - big.shape[1]) // 2
        icon[y0:y0 + big.shape[0], x0:x0 + big.shape[1]] = big
        png(dest / f'icon-{size}.png', icon)

    # What the page tint injects into every site, each part while it is on.
    # Named per theme: the companion registers them by file name, so a theme
    # switch registers new files rather than counting on Chromium rereading.
    tints = {
        'scrollbars': f":root {{ scrollbar-color: {palette['accent']} {palette['darker_background']}; }}\n",
        'selection': f"::selection {{ background-color: {palette['accent']}; color: {palette['bright_foreground']}; }}\n",
    }
    for old in dest.glob('tint-*.css'):
        old.unlink()
    for part, css in tints.items():
        (dest / f'tint-{NAME}-{part}.css').write_text(f"/* {TITLE}: generated by tools/chromium.py */\n{css}")

    sounds = dest / 'sounds'
    sounds.mkdir(parents=True, exist_ok=True)
    for old in sounds.glob('*.wav'):
        old.unlink()
    for key, name in SOUNDS.items():
        src = GAME / 'game/sounds' / f'{name}.wav'
        if src.exists():
            (sounds / f'{key}.wav').write_bytes(src.read_bytes())
    return sheet.shape


if __name__ == '__main__':
    m = build_theme()
    print(f"{OUT / 'theme'}  {m['name']} {m['version']}")
    h, w = build_art()[:2]
    print(f"{OUT / 'extras/art'}  atlas {w}x{h}")
