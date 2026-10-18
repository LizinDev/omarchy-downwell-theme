"""preview.png: a pixel-art palette specimen built only from colors.toml and a
system font (no game art, so it is safe to publish).

    python3 -I tools/preview.py "<title>" "<subtitle>" preview.png
"""
import subprocess
import sys
import numpy as np

sys.path.insert(0, sys.argv[0].rsplit('/', 1)[0])
from palette import KEYS, BG, FG, ACCENT  # noqa: E402

TITLE, SUBTITLE, OUT = sys.argv[1:4]
W, H, SCALE = 450, 253, 4          # 1800x1012 like the stock previews
FONT = '/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Bold.ttf'

GRID = [
    ['background', 'dark_background', 'darker_background', 'lighter_background', 'selection', 'muted'],
    ['dark_foreground', 'foreground', 'light_foreground', 'bright_foreground', 'accent', 'brown'],
    ['red', 'yellow', 'orange', 'green', 'cyan', 'blue'],
    ['magenta', 'bright_red', 'bright_yellow', 'bright_green', 'bright_cyan', 'bright_blue'],
]

bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 + 1 / 32
y = np.arange(H)[:, None]
x = np.arange(W)[None, :]
px = np.empty((H, W, 3), np.uint8)
px[:] = BG
px[np.clip((y - 222) / 26, 0, 1) > bayer[y % 4, x % 4]] = ACCENT


def label(text, size):
    """Text rasterised without antialiasing at native size: a bool mask."""
    raw = subprocess.check_output(['magick', '-background', 'black', '-fill', 'white', '+antialias',
                                   '-font', FONT, '-pointsize', str(size), f'label:{text}',
                                   '-trim', '+repage', '-depth', '8', 'gray:-'])
    dims = subprocess.check_output(['magick', '-background', 'black', '-fill', 'white', '+antialias',
                                    '-font', FONT, '-pointsize', str(size), f'label:{text}',
                                    '-trim', '+repage', '-format', '%w %h', 'info:']).split()
    w, h = int(dims[0]), int(dims[1])
    return np.frombuffer(raw, np.uint8).reshape(h, w) > 127


def stamp(mask, x0, y0, color, shadow=None):
    h, w = mask.shape
    if shadow:
        px[y0 + 1:y0 + 1 + h, x0:x0 + w][mask] = shadow
    px[y0:y0 + h, x0:x0 + w][mask] = color


# 3x5 hex digits, drawn by hand: legible at one native pixel per dot.
HEX = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001001010010',
    '8': '111101111101111', '9': '111101111001111', 'A': '010101111101101', 'B': '110101110101110',
    'C': '011100100100011', 'D': '110101101101110', 'E': '111100110100111', 'F': '111100110100100',
    '#': '101111101111101',
}


def hexlabel(text):
    mask = np.zeros((5, 4 * len(text) - 1), bool)
    for i, ch in enumerate(text):
        mask[:, 4 * i:4 * i + 3] = np.array([c == '1' for c in HEX[ch]]).reshape(5, 3)
    return mask


def lum(c):
    lin = [(v / 255) / 12.92 if v / 255 <= .04045 else ((v / 255 + .055) / 1.055) ** 2.4 for v in c]
    return .2126 * lin[0] + .7152 * lin[1] + .0722 * lin[2]


title = label(TITLE, 22)
stamp(title, (W - title.shape[1]) // 2, 18, FG, ACCENT)
sub = label(SUBTITLE, 9)
stamp(sub, (W - sub.shape[1]) // 2, 18 + title.shape[0] + 8, KEYS['dark_foreground'])

cw, ch, gap = 58, 32, 6
gx = (W - (6 * cw + 5 * gap)) // 2
gy = 72
shadow = KEYS['darker_background'] if lum(BG) > 0.002 else (0, 0, 0)
for r, row in enumerate(GRID):
    for q, key in enumerate(row):
        x0, y0 = gx + q * (cw + gap), gy + r * (ch + gap)
        color = KEYS[key]
        px[y0 + 2:y0 + ch + 2, x0 + 2:x0 + cw + 2] = shadow       # hard drop shadow
        px[y0:y0 + ch, x0:x0 + cw] = color
        if key == 'background':                                   # keep the field visible
            px[y0, x0:x0 + cw] = px[y0 + ch - 1, x0:x0 + cw] = KEYS['muted']
            px[y0:y0 + ch, x0] = px[y0:y0 + ch, x0 + cw - 1] = KEYS['muted']
        text = hexlabel('#%02X%02X%02X' % color)
        ink = BG if lum(color) > 0.35 else FG
        stamp(text, x0 + 4, y0 + ch - text.shape[0] - 4, ink)

big = px.repeat(SCALE, 0).repeat(SCALE, 1)
subprocess.run(['magick', '-size', f'{W * SCALE}x{H * SCALE}', '-depth', '8', 'rgb:-', f'PNG24:{OUT}'],
               input=big.tobytes(), check=True)
