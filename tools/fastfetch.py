#!/usr/bin/env python3
"""fastfetch.txt: the fastfetch logo, the hero mid-air as in 1-clouds.png
(sprPlayerAir frame 4), encoded as truecolor half-blocks at 4x.

    python3 -I tools/fastfetch.py

Built from the game's own sprites (compose.py), so like the sprite
backgrounds it stays local (.gitignore). The theme-set hook that installs it
lives in the DORFic theme repo (tools/fastfetch-hook).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np  # noqa: E402
from compose import Canvas  # noqa: E402
from palette import BG  # noqa: E402

THEME = Path(__file__).resolve().parent.parent
SCALE = 4                    # ~56x20 cells, about the stock logo's size


def draw():
    c = Canvas(32, 32)
    c.blit('sprPlayerAir', 16, 16, 4)
    # the canvas starts as the theme background; anything still that color
    # is empty space (the sprites' black maps to it too)
    on = np.any(c.px != np.array(BG, np.uint8), axis=2)
    ys, xs = np.nonzero(on)
    box = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
    px, on = c.px[box], on[box]
    px = px.repeat(SCALE, 0).repeat(SCALE, 1)
    on = on.repeat(SCALE, 0).repeat(SCALE, 1)
    if px.shape[0] % 2:  # whole cells: pad an odd height with an empty row
        px = np.concatenate([px, px[-1:]])
        on = np.concatenate([on, np.zeros_like(on[-1:])])
    return px.astype(int), on


def encode(rgb, on):
    rows = rgb.shape[0] // 2
    lines = []
    for row in range(rows):
        top, bottom = 2 * row, 2 * row + 1
        cells = []
        for x in range(rgb.shape[1]):
            t, b = on[top, x], on[bottom, x]
            if t and b:
                cells.append(('38;2;%d;%d;%d;48;2;%d;%d;%d' % (*rgb[top, x], *rgb[bottom, x]), '▀'))
            elif t:
                cells.append(('49;38;2;%d;%d;%d' % tuple(rgb[top, x]), '▀'))
            elif b:
                cells.append(('49;38;2;%d;%d;%d' % tuple(rgb[bottom, x]), '▄'))
            else:
                cells.append((None, ' '))
        while cells and cells[-1][0] is None:
            cells.pop()
        out, state = [], None
        for code, char in cells:
            if code is None and state is not None:
                out.append('\x1b[0m')
            elif code is not None and code != state:
                out.append('\x1b[%sm' % code)
            state = code
            out.append(char)
        lines.append(''.join(out) + ('\x1b[0m' if state is not None else ''))
    while lines and not lines[0]:
        lines.pop(0)
    while lines and not lines[-1]:
        lines.pop()
    return '\n'.join(lines) + '\n'


def main():
    rgb, on = draw()
    out = THEME / 'fastfetch.txt'
    out.write_text(encode(rgb, on))
    print(out)


if __name__ == '__main__':
    main()
