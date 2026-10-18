"""Repaint a Nikaido-palette Downwell image (the clouds wallpaper) in this
theme's palette, color for color: field, accent, ink and the stray blue."""
import sys
import numpy as np
from pathlib import Path

sys.path.insert(0, sys.argv[0].rsplit('/', 1)[0])
from palette import BG, ACCENT, FG, BLUE  # noqa: E402
sys.path.append(str(Path.home() / 'Projects/Downwell/tools'))
from game_sprites import write_png  # noqa: E402
import subprocess

src, out = sys.argv[1], sys.argv[2]
w, h = (int(v) for v in subprocess.check_output(['magick', 'identify', '-format', '%w %h', src]).split())
px = np.frombuffer(subprocess.check_output(['magick', src, '-depth', '8', 'rgb:-']), np.uint8).reshape(h, w, 3)
source = {(0x19, 0x1a, 0x0c): BG, (0xfd, 0x93, 0x01): ACCENT, (0xfe, 0xfe, 0xfe): FG, (0x1d, 0x50, 0xc2): BLUE}
outpx = np.zeros((h, w, 4), np.uint8)
outpx[..., 3] = 255
seen = np.zeros((h, w), bool)
for old, new in source.items():
    hit = np.all(px == old, axis=-1)
    outpx[hit, :3] = new
    seen |= hit
if not seen.all():
    sys.exit(f'{(~seen).sum()} pixels outside the expected four colors')
write_png(out, w, h, outpx.tobytes())
