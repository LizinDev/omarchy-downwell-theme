"""The Welling of Isaac: a basement room built from Downwell sprites.

Rock walls with a door on every side (gem over the treasure door, skulls by
the boss door), Welltaro in the middle shooting bubble tears at a swarm of
flies, a heart in a glass dome on its pedestal, rocks with one gem block as
the tinted rock, fires, pots, spikes, cobwebs and blood on the floor. Hearts,
pickup counters, the active item and the minimap in the corners.
"""
import sys
sys.path.insert(0, sys.argv[0].rsplit('/', 1)[0])
from compose import Canvas, text, stand, frame, disc, BG, FG, ACCENT  # noqa: E402
import numpy as np  # noqa: E402

c = Canvas(480, 270)
OY = -2
Y = lambda r: r * 16 + OY
X = lambda q: q * 16
CX = lambda q: q * 16 + 8                  # cell centre
CY = lambda r: r * 16 + OY + 8
COLS, ROWS = 30, 17
DOORS = {(14, 0), (15, 0), (14, 1), (15, 1), (14, 15), (15, 15), (14, 16), (15, 16),
         (0, 8), (1, 8), (0, 7), (1, 7), (28, 7), (29, 7), (28, 8), (29, 8)}


def wall(q, r):
    return q < 2 or q > 27 or r < 2 or r > 14


def solid(q, r):
    if (q, r) in DOORS:
        return False
    if q < 0 or q >= COLS or r < 0 or r >= ROWS:
        # carry the door openings out past the canvas edge
        if (min(max(q, 0), COLS - 1), min(max(r, 0), ROWS - 1)) in DOORS:
            return False
        return 'hidden'
    return wall(q, r)


# the walls: autotiled faces where they meet the floor and the doors, brick
# courses (horizontal along the top and bottom, vertical up the sides) inside
WALL = 'sprTile1'
CORNERS = [(25, -1, -1), (24, 1, -1), (21, -1, 1), (20, 1, 1)]
for r in range(ROWS):
    for q in range(COLS):
        if solid(q, r) is not True:
            continue
        idx = (1 if solid(q, r - 1) else 0) + (2 if solid(q + 1, r) else 0) + \
              (4 if solid(q, r + 1) else 0) + (8 if solid(q - 1, r) else 0)
        if idx == 15:
            across, up = r < 2 or r > 14, q < 2 or q > 27
            idx = 5 if up and not across else 10
        c.blit(WALL, CX(q), CY(r), idx)
        if idx == 15:
            for f, dq, dr in CORNERS:
                if not solid(q + dq, r + dr):
                    c.blit(WALL, CX(q), CY(r), f)

# the floor: a faint stipple, and old blood
yy, xx = np.mgrid[:c.h, :c.w]
floor = (yy >= Y(2)) & (yy < Y(15)) & (xx >= X(2)) & (xx < X(28))
stipple = (yy % 6 == 0) & (xx % 12 == (yy // 6 % 2) * 6)
c.px[floor & stipple & np.all(c.px == BG, axis=-1)] = FG
for x, y, f in [(150, 190, 2), (310, 214, 3), (96, 92, 3), (388, 174, 2), (232, 170, 3)]:
    c.blit('sprFxRedSplash', x, y, f)

# doors: gem over the treasure room, skulls flanking the boss room
c.blit('sprGemM', 240, Y(0) + 9, 0)
for y in (Y(6) + 6, Y(9) + 10):
    c.blit('sprSkullCalm', X(29) - 2, y, 0)
for r in (7, 8):
    stand(c, 'sprTrapActiveSpikes', CX(26), Y(r + 1), 3)

# a cobweb in the corner the HUD leaves free
c.blit('sprCobweb32', X(28) - 1, Y(2), flip=True)

# fires in the bottom corners, pots and rocks
for q in (3, 26):
    stand(c, 'sprFire', CX(q), Y(15) - 2, 3 if q == 3 else 6)
for q, r in [(6, 3), (25, 13)]:
    stand(c, 'sprPoisonPot', CX(q), Y(r + 1))
ROCKS = [(9, 10, 0), (10, 10, 1), (9, 11, 3), (19, 10, 1), (20, 10, 2), (20, 11, 0), (6, 6, 2), (23, 6, 3)]
for q, r, f in ROCKS:
    c.blit('sprLimbobRock', CX(q), CY(r), f)
c.blit('sprTile1', CX(10), CY(11), 22)         # the tinted rock

# treasure: a heart in a glass dome on its pedestal
stand(c, 'sprPedestalLife', CX(14) + 8, Y(5), 0)

# pickups lying about
c.blit('sprGemS', CX(12), CY(13), 1)
c.blit('sprGemS', CX(13), CY(12) + 4, 2)
c.blit('sprBonusHeart', CX(22), CY(4), 0)
BX, BY = CX(7), CY(13)                        # a bomb: the red ball's disc and a lit fuse
disc(c, BX, BY, 6, ACCENT)
c.px[BY - 3:BY - 1, BX - 3:BX - 1] = FG
c.px[BY - 9:BY - 5, BX + 3] = FG
c.px[BY - 10, BX + 4] = ACCENT

# enemies: a gaper, a spider, a host, and the fly swarm being shot at
stand(c, 'sprKidEyeflapWalk', CX(5), Y(10), 2)
stand(c, 'sprSpiderWalk', CX(22), Y(13), 1, flip=True)
stand(c, 'sprJumpySkullIdle', CX(17), Y(4), 0)
for x, y, f in [(352, 100, 0), (372, 116, 1), (346, 128, 2), (390, 96, 1)]:
    c.blit('sprBug', x, y, f, flip=True)

# Welltaro, crying bubble tears toward the flies
stand(c, 'sprPlayerShoot', 240, Y(9) + 4, 1)
for x, y in [(262, 126), (284, 122), (306, 119), (326, 116)]:
    c.blit('sprFxWhiteSplash', x, y + 4, 0)
c.blit('sprFxWhiteSplash', 342, 114, 2)

# HUD: active item, hearts, counters, minimap
c.px[6:32, 4:86] = BG
c.blit('sprUgSlot', 18, 22, 0)
c.blit('sUgZen', 18, 22, 0)
for i in range(4):
    c.blit('sprHudLifeHeart', 36 + i * 12, 14, 0 if i < 3 else 2)
for i, (icon, count) in enumerate([('sprGemS', '07'), ('bomb', '01'), ('sprLocked', '00')]):
    y = 40 + i * 14
    c.px[y - 2:y + 13, 36:70] = BG
    if icon == 'bomb':                            # the red ball, shrunk to icon size, with a fuse
        disc(c, 44, y + 7, 4, ACCENT)
        c.px[y:y + 3, 46] = FG
    else:
        img, _ = frame(icon, 0)
        ys, xs = np.nonzero(img[..., 3])
        crop = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        c.paste(crop, 44 - crop.shape[1] // 2, y + 6 - crop.shape[0] // 2)
    text(c, count, 54, y + 1)

ROOMS = {(1, 1): 'here', (1, 0): 'treasure', (0, 1): '', (2, 1): 'boss', (1, 2): '', (0, 2): ''}
MX, MY, RW, RH = 418, 8, 12, 7
c.px[MY - 3:MY + 3 * (RH + 2) + 1, MX - 3:MX + 3 * (RW + 2) + 1] = BG
for (gx, gy), kind in ROOMS.items():
    x0, y0 = MX + gx * (RW + 2), MY + gy * (RH + 2)
    if kind == 'here':
        c.px[y0:y0 + RH, x0:x0 + RW] = FG
    else:
        c.px[y0, x0:x0 + RW] = c.px[y0 + RH - 1, x0:x0 + RW] = FG
        c.px[y0:y0 + RH, x0] = c.px[y0:y0 + RH, x0 + RW - 1] = FG
    if kind in ('treasure', 'boss'):
        c.px[y0 + 2:y0 + 5, x0 + 4:x0 + 8] = ACCENT

c.save(sys.argv[1], 4)
