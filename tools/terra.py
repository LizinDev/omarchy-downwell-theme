"""Terrawell: a Terraria-style world cross-section built from Downwell sprites.

Night sky and moon over a surface with a stone house and the shopkeeper as the
Guide; the well drops straight through the layers; Welltaro digs a tunnel by
torchlight with the gem drill in hand; gem blocks sit in the rock like ore; a
cave below holds a chest, a skeleton and a bat. Hotbar and hearts up top.
"""
import sys
sys.path.insert(0, sys.argv[0].rsplit('/', 1)[0])
from compose import Canvas, tiles, text, stand, frame, BG, FG, ACCENT  # noqa: E402
import numpy as np  # noqa: E402

c = Canvas(480, 270)
OY = -2
Y = lambda r: r * 16 + OY
X = lambda q: q * 16
COLS, ROWS = 30, 17

# night sky: the game's moon and stars, plus a moonless copy for the left half
sky, _ = frame('bgNightsky', 0)
c.paste(sky, 424 - 140, 70 - 43)                  # moon over the right-hand hills
stars = frame('bgNightsky', 2)[0].copy()
stars[:, 110:170] = 0
c.paste(stars, -10, 22)

# --- terrain -----------------------------------------------------------------
surface = [8] * 10 + [7] * 4 + [8] * 11 + [9] * 5
open_cells = set()
for r in range(8, ROWS + 1):                      # the well shaft
    for q in (18, 19):
        open_cells.add((q, r))
for q in range(9, 18):                            # the tunnel being dug
    open_cells |= {(q, 11), (q, 12)}
for r, a, b in [(12, 23, 26), (13, 20, 28), (14, 20, 28), (15, 22, 27)]:   # the cave
    open_cells |= {(q, r) for q in range(a, b + 1)}
for r, a, b in [(14, 3, 7), (15, 3, 7)]:          # a pot pocket
    open_cells |= {(q, r) for q in range(a, b + 1)}
ORE = {(2, 10), (3, 10), (3, 11), (13, 15), (14, 15), (25, 10), (26, 10), (9, 15), (22, 11), (11, 9), (6, 12)}


def solid(q, r):
    if (q, r) in open_cells or r < 0:
        return False
    if q < 0 or q >= COLS or r >= ROWS:
        return 'hidden'
    if r < surface[q]:
        return False
    return 'sprTile4' if r >= 14 else 'sprTile1'


tiles(c, solid, oy=OY, special={cell: 22 for cell in ORE})

# packed earth: a sparse stipple on the fully enclosed (otherwise black) cells
yy, xx = np.mgrid[:c.h, :c.w]
stipple = (yy % 4 == 0) & (xx % 8 == (yy // 4 % 2) * 4)
for r in range(ROWS):
    for q in range(COLS):
        if solid(q, r) and (q, r) not in ORE and all(solid(q + dq, r + dr) for dq, dr in ((0, 1), (1, 0), (0, -1), (-1, 0))) \
                and all(solid(q + dq, r + dr) for dq, dr in ((1, 1), (1, -1), (-1, 1), (-1, -1))):
            y0, x0 = max(0, Y(r)), X(q)
            cell = c.px[y0:Y(r) + 16, x0:x0 + 16]
            mask = stipple[y0:Y(r) + 16, x0:x0 + 16] & np.all(cell == BG, axis=-1)
            cell[mask] = FG

# --- surface ----------------------------------------------------------------
GROUND = lambda q: Y(surface[q])
stand(c, 'sprHouse1', 30, GROUND(2))
stand(c, 'sprShopKeeper', 140, GROUND(8), 1)
stand(c, 'sprTrees', 158, GROUND(10), 2)
stand(c, 'sprTrees', 372, GROUND(23), 3)
stand(c, 'sprTrees', 452, GROUND(28), 2)
for x, q, f in [(58, 3, 0), (196, 12, 1), (236, 14, 3), (348, 21, 2), (412, 25, 0), (120, 7, 2)]:
    stand(c, 'sprGrass', x, GROUND(q), f)
stand(c, 'sprEnmSlime', 200, GROUND(12), 0)
c.blit('sprEnmSlimeAir', 424, GROUND(26) - 26, 0)

# the well: the game's bucket frame (posts, beam, pulley, rope and bucket),
# shortened by cutting rope-only rows and post-only columns, over the shaft
frame_px, _ = frame('sprBucketTest')
rows = np.concatenate([frame_px[0:34], frame_px[90:148], frame_px[170:176]])
well = np.concatenate([rows[:, 0:32], rows[:, 50:110], rows[:, 128:160]], 1)
c.px[GROUND(18) - well.shape[0]:GROUND(18), X(19) - 62:X(19) - 62 + well.shape[1]] = BG   # no stars through the frame
c.paste(well, X(19) - 62, GROUND(18) - well.shape[0])

# --- underground --------------------------------------------------------------
# Welltaro at the tunnel face with the smart cursor on the next block
stand(c, 'sprPlayerDig', X(9) + 14, Y(13), 4, flip=True)
cx, cy = X(8), Y(12)
for (x, y), (dx, dy) in zip([(cx, cy), (cx + 15, cy), (cx, cy + 15), (cx + 15, cy + 15)],
                            [(1, 1), (-1, 1), (1, -1), (-1, -1)]):
    for k in range(4):
        c.px[y, x + dx * k] = ACCENT
        c.px[y + dy * k, x] = ACCENT
for q in (12, 15):
    stand(c, 'sprDungTorch', X(q) + 8, Y(13), 0)

# the cave: chest, skeleton, bat, ore pile, a torch
stand(c, 'sprAirChest', X(25) + 4, Y(16), 0)
stand(c, 'sprEnmSkeletonIdle', X(22) + 8, Y(16), 0)
c.blit('sprBat', X(27), Y(13) + 4, 2, flip=True)
stand(c, 'sprGemChunk', X(27) + 6, Y(16), 1)
stand(c, 'sprDungTorch', X(23) + 8, Y(16), 0)

# the pocket: pots, as Terraria leaves them in caves
for x in (X(4) + 6, X(5) + 10):
    stand(c, 'sprPoisonPot', x, Y(16))
stand(c, 'sprGemsack', X(7) + 2, Y(16))

# --- UI -----------------------------------------------------------------------
c.px[6:40, 352:480] = BG                          # keep the hearts clear of the stars
SLOT, STEP, HX, HY = 20, 22, 8, 21
items = [('sprBoots', 0, ''), ('sUgDrill', 0, ''), ('sprDungTorch', 0, '99'), ('sprGemS', 0, '128'),
         ('sprMine', 0, '12'), ('sprBottle', 0, '5'), ('sprItemCherry', 0, '3'), ('sUgRocket', 0, ''),
         ('sprBonusHeart', 0, '2'), ('sUgApple', 0, '')]
SELECTED = 1
text(c, 'GEM DRILL', HX, 9)
for i, (name, f, count) in enumerate(items):
    x0, y0 = HX + i * STEP, HY
    c.px[y0:y0 + SLOT, x0:x0 + SLOT] = BG
    ink, w = (ACCENT, 2) if i == SELECTED else (FG, 1)
    c.px[y0:y0 + w, x0:x0 + SLOT] = ink
    c.px[y0 + SLOT - w:y0 + SLOT, x0:x0 + SLOT] = ink
    c.px[y0:y0 + SLOT, x0:x0 + w] = ink
    c.px[y0:y0 + SLOT, x0 + SLOT - w:x0 + SLOT] = ink
    img, (ox, oy) = frame(name, f)
    ys, xs = np.nonzero(img[..., 3])
    crop = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    crop = crop[:SLOT - 4, :SLOT - 4]
    c.paste(crop, x0 + (SLOT - crop.shape[1]) // 2, y0 + (SLOT - crop.shape[0]) // 2)
    text(c, str((i + 1) % 10), x0 + 2, y0 + 2, font='fontSmall')
    if count:
        text(c, count, x0 + SLOT - 2, y0 + SLOT - 8, font='fontSmall', align='right')

text(c, 'LIFE: 340/400', 472, 9, align='right')
for i in range(10):
    c.blit('sprHudLifeHeart', 360 + i * 12, 26, 0 if i < 8 else 2)
c.save(sys.argv[1], 4)
