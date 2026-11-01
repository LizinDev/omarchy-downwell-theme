"""Build chromium/: a Chromium theme extension and the art of its companion
extension, from colors.toml and the installed game's sprites.

    python3 -I tools/chromium.py

chromium/theme   the theme: colors from colors.toml, the well's rim along the
                 tab strip, a red edge on the selected tab, and the title
                 backdrop on Chromium's own new tab page
chromium/extras  the companion (title-screen new tab page, pause-menu popup, shop
                 side panel, page scrollbars, selection and cursors); this
                 writes only its art/, the code is checked in

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


# The companion's sprites: name -> frames, or (frames, quarter turns clockwise).
SPRITES = {
    'sprBgWell': 1, 'sprTitle': 1, 'sprPlayerAir': 5, 'sprGemS': 1, 'sprGemM': 1,
    'sprTextBox': 1, 'sprSelectArrow': 1, 'sprStCursor': 1,
    'sprUgSlot': 2, 'sprLocked': 1, 'sprHudLifeHeart': 1, 'sprPauseIcons': 3, 'sprDeathIcons': 1,
    'sprShopSign': 1, 'sprShopKeeper': 1, 'sprShopCounter': 1, 'sprShopMsg': 1, 'sprShopArrowS': 4,
    'sprGemsack': 1, 'sprSkullCalm': 1,
}
# The upgrades' small icons (their second frame, 12 px), each also as a dim
# silhouette ('...Off') for switches that are off. The popup gives one to each
# setting; the shop hands them out to bookmark folders.
UPGRADES = [
    'sUgFlap', 'sUgHeadboot', 'sUgGravSuit', 'sUgFengshui', 'sUgAlchemy', 'sUgHardskin', 'sUgFightin',
    'sUgCandle', 'sUgLeak', 'sUgDrone', 'sUgGemAttractor', 'sUgKnF', 'sUgLaserSight', 'sUgDumbbell',
    'sUgExplodingKnees', 'sUgWeirdGem', 'sUgStraightShooter', 'sUgApple', 'sUgDrill', 'sUgGemPowered',
    'sUgZen', 'sUgRIP', 'sUgChainReaction', 'sUgYouth', 'sUgMembersCard', 'sUgBlastMod', 'sUgDecoy',
    'sUgEngineering', 'sUgGemPop', 'sUgTime', 'sUgRocket', 'sUgSuperBtry', 'sUgLess', 'sUgFortune', 'sUgSafety',
]
# Latin-1 and the two punctuation marks the game's font adds; enough for
# Portuguese dates and most page titles. Anything else falls back to '?'.
CHARS = [chr(c) for c in range(32, 127)] + [chr(c) for c in range(160, 256)] + ['–', '…']
SOUNDS = {'move': 'sfxShopScroll', 'pick': 'sfxUiMenu_Select_Confirm', 'back': 'sfxShopBack', 'gem': 'sfxGemGet'}

# The page cursors, drawn here in the game's way (a light body in a dark rim)
# since the game itself has none: the arrow, an I-beam, and over links the
# arrow in the accent (the game's menus turn what you would pick red).
# X rim, W body, R accent, . clear; then the hot spot in art pixels.
CURSORS = {
    'arrow': ([
        'X.........',
        'XX........',
        'XWX.......',
        'XWWX......',
        'XWWWX.....',
        'XWWWWX....',
        'XWWWWWX...',
        'XWWWWWWX..',
        'XWWWWWWWX.',
        'XWWWWXXXXX',
        'XWWXWWX...',
        'XWX.XWWX..',
        'XX..XWWX..',
        '.....XWWX.',
        '.....XXXX.',
    ], (0, 0)),
    'text': ([
        'XXX.XXX',
        'XWWXWWX',
        'XXXWXXX',
        '..XWX..',
        '..XWX..',
        '..XWX..',
        '..XWX..',
        '..XWX..',
        '..XWX..',
        '..XWX..',
        '..XWX..',
        'XXXWXXX',
        'XWWXWWX',
        'XXX.XXX',
    ], (3, 7)),
}
CURSORS['hand'] = ([r.replace('W', 'R') for r in CURSORS['arrow'][0]], CURSORS['arrow'][1])
CURSOR_SCALE = 2
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

    def add(img, ox, oy):
        part, dx, dy = crop(img)
        x, y = atlas.add(part)
        return [int(x), int(y), part.shape[1], part.shape[0], int(dx - ox), int(dy - oy)]

    for name, spec in SPRITES.items():
        count, quarters = spec if isinstance(spec, tuple) else (spec, 0)
        frames = []
        for i in range(count):
            img, (ox, oy) = frame(name, i)
            img, ox, oy = turn(img, ox, oy, quarters)
            frames.append(add(img, ox, oy))
        sprites[name] = frames
    for name in UPGRADES:
        img, (ox, oy) = frame(name, 1)
        sprites[name] = [add(img, ox, oy)]
        off = np.zeros_like(img)
        off[(img[..., 3] > 0) & (img[..., :3] != BG).any(-1)] = (*k['dark_foreground'], 255)
        off[(img[..., 3] > 0) & (img[..., :3] == BG).all(-1)] = (*BG, 255)
        sprites[f'{name}Off'] = [add(off, ox, oy)]

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
        'upgrades': UPGRADES,
        'font': {'height': 10, 'chars': chars},
    }, separators=(',', ':')))
    # What the companion injects into every site, part by part while each is
    # on: a stylesheet, and for the cursors also a script (checked in, the
    # same for every theme). The CSS files are named per theme: the companion
    # registers them by file name, so a theme switch registers new files
    # rather than counting on Chromium rereading.
    (dest / 'theme.json').write_text(json.dumps({
        'name': NAME, 'title': TITLE, 'built': VERSION, 'palette': palette,
        'tints': {
            'scrollbars': {'css': [f'art/tint-{NAME}-scrollbars.css']},
            'selection': {'css': [f'art/tint-{NAME}-selection.css']},
            'cursors': {'css': [f'art/tint-{NAME}-cursors.css'], 'js': ['cursors.js']},
        },
        # the companion's own pages wear the same cursors (content scripts
        # never reach extension pages)
        'cursors': {
            name: {'file': f'art/page-{NAME}-cursor-{name}.png', 'hot': [v * CURSOR_SCALE for v in spot]}
            for name, (_, spot) in CURSORS.items()
        },
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

    # download notifications: the gem sack when one lands, a skull when it fails
    for name, sprite in (('done', 'sprGemsack'), ('failed', 'sprSkullCalm')):
        img, _ = frame(sprite, 0)
        part, _, _ = crop(img)
        s = 120 // max(part.shape[:2])
        big = part.repeat(s, 0).repeat(s, 1)
        icon = np.zeros((128, 128, 4), np.uint8)
        y0, x0 = (128 - big.shape[0]) // 2, (128 - big.shape[1]) // 2
        icon[y0:y0 + big.shape[0], x0:x0 + big.shape[1]] = big
        png(dest / f'notify-{name}.png', icon)

    # The page parts. Their images are named per theme like the stylesheets,
    # and reach pages as extension URLs: a page's CSP blocks data: images but
    # lets extension resources through.
    for old in [*dest.glob('tint-*.css'), *dest.glob('page-*.png')]:
        old.unlink()
    url = 'chrome-extension://__MSG_@@extension_id__/art'
    ink = {'X': (*BG, 255), 'W': (*k['bright_foreground'], 255), 'R': (*ACCENT, 255), '.': (0, 0, 0, 0)}
    for name, (rows, _) in CURSORS.items():
        px = np.array([[ink[c] for c in r] for r in rows], np.uint8)
        png(dest / f'page-{NAME}-cursor-{name}.png', px, CURSOR_SCALE)

    def cursor(name, fallback):
        x, y = (v * CURSOR_SCALE for v in CURSORS[name][1])
        return f'url({url}/page-{NAME}-cursor-{name}.png) {x} {y}, {fallback}'

    # the ammo gauge's frame, a nine-slice: the rim in the ink, its corners cut
    gauge = np.zeros((3, 3, 4), np.uint8)
    gauge[:] = (*BG, 255)
    gauge[0, 1] = gauge[1, 0] = gauge[1, 2] = gauge[2, 1] = (*FG, 255)
    png(dest / f'page-{NAME}-gauge.png', gauge, 2)

    p = palette
    clickable = ', '.join([
        'a[href]', 'button:not(:disabled)', 'summary', 'label[for]', 'select:not(:disabled)',
        *(f'[role={r}]:not([aria-disabled=true])' for r in ('button', 'link', 'tab', 'menuitem', 'option', 'checkbox', 'radio', 'switch')),
        *(f'input[type={t}]:not(:disabled)' for t in ('button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'color', 'image', 'range')),
    ])
    typing = ', '.join([
        'input:not([type])', 'textarea', '[contenteditable]:not([contenteditable=false])',
        *(f'input[type={t}]' for t in ('text', 'search', 'email', 'url', 'tel', 'password', 'number')),
    ])
    tints = {
        # The gunboots' ammo gauge: a white rim with cut corners, a black gap,
        # and the charge in the accent, cut into rounds. It turns white while
        # held, as the gauge flashes when it recharges.
        'scrollbars': f"""
::-webkit-scrollbar {{ width: 16px; height: 16px; background: {p['background']}; }}
::-webkit-scrollbar-button {{ display: none; }}
::-webkit-scrollbar-corner {{ background: {p['background']}; }}
::-webkit-scrollbar-track {{ border: 2px solid {p['foreground']}; border-image: url({url}/page-{NAME}-gauge.png) 2 fill / 2px; }}
::-webkit-scrollbar-thumb {{ border: 4px solid transparent; background-clip: padding-box; background-color: {p['accent']}; }}
::-webkit-scrollbar-thumb:vertical {{ min-height: 24px; background-image: repeating-linear-gradient(to bottom, transparent 0 10px, {p['background']} 10px 12px); }}
::-webkit-scrollbar-thumb:horizontal {{ min-width: 24px; background-image: repeating-linear-gradient(to right, transparent 0 10px, {p['background']} 10px 12px); }}
::-webkit-scrollbar-thumb:hover, ::-webkit-scrollbar-thumb:active {{ background-color: {p['bright_foreground']}; }}
""",
        'selection': f"""
::selection {{ background-color: {p['accent']}; color: {p['bright_foreground']}; }}
:root {{ caret-color: {p['accent']}; }}
""",
        # cursors.js marks the element under the pointer when the page asks it
        # for an arrow, a hand or an I-beam of its own, for the last rules.
        'cursors': f"""
:root {{ cursor: {cursor('arrow', 'default')}; }}
:is({clickable}) {{ cursor: {cursor('hand', 'pointer')} !important; }}
:is({typing}) {{ cursor: {cursor('text', 'text')} !important; }}
[data-gunboots-cursor=arrow] {{ cursor: {cursor('arrow', 'default')} !important; }}
[data-gunboots-cursor=hand] {{ cursor: {cursor('hand', 'pointer')} !important; }}
[data-gunboots-cursor=text] {{ cursor: {cursor('text', 'text')} !important; }}
""",
    }
    for part, css in tints.items():
        (dest / f'tint-{NAME}-{part}.css').write_text(f"/* {TITLE}: generated by tools/chromium.py */{css}")

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
