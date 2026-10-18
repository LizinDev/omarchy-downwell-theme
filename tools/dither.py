"""Generated, publish-safe background: the palette's three bands (field,
accent, white) joined by 4x4 ordered dither at a 4x pixel scale."""
import sys, zlib, struct
import numpy as np

sys.path.insert(0, sys.argv[0].rsplit('/', 1)[0])
from palette import BG, ACCENT, FG  # noqa: E402
W, H, SCALE = 480, 270, 4
bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16 + 1 / 32
y = np.arange(H)[:, None]
x = np.arange(W)[None, :]
threshold = bayer[y % 4, x % 4]

def ramp(a, b):
    return np.clip((y - a) / (b - a), 0, 1)

px = np.empty((H, W, 3), np.uint8)
px[:] = BG
px[ramp(150, 214) > threshold] = ACCENT
px[ramp(222, 262) > threshold] = FG
big = px.repeat(SCALE, 0).repeat(SCALE, 1)
h, w = big.shape[:2]
rows = b''.join(b'\0' + big[r].tobytes() for r in range(h))
def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))
open(sys.argv[1], 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
                              + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b''))
