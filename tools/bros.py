"""Super Welltaro Bros.: World 1-1 rebuilt from Downwell's own sprites.

Gem blocks for ? blocks, striped catacomb bricks, a slime for the Goomba, the
grounded turtle for the Koopa, the stone well standing in for the warp pipe with
a spore plant in it, and Welltaro mid-jump knocking a gem out of a block.
"""
import sys
sys.path.insert(0, sys.argv[0].rsplit('/', 1)[0])
from compose import Canvas, tiles, text, stand, bbox, cloud, frame, BG, FG, ACCENT  # noqa: E402
import numpy as np  # noqa: E402

c = Canvas(480, 270)
OY = -2                      # rows of 16 px; row 15 is the ground's top at y = 238
GROUND = 15 * 16 + OY
Y = lambda r: r * 16 + OY
X = lambda q: q * 16

# sky: two flat-bottomed clouds in the game's outline style
cloud(c, 96, 78, [(-14, 0, 9), (0, -5, 12), (13, -1, 9)])
cloud(c, 330, 58, [(-22, 0, 8), (-8, -6, 12), (8, -4, 11), (21, 0, 8)])
cloud(c, 214, 92, [(-7, 0, 6), (5, -3, 8)])

# scenery behind the action: a round tree for the hill, a shrub for the bush
stand(c, 'sprTree', 22, GROUND, 0)
stand(c, 'sprTrees', 62, GROUND, 3)

# the ground: two rows of striped catacomb brick, running under the well
def solid(q, r):
    if r >= 17:
        return 'hidden'
    return r >= 15
tiles(c, solid, 'sprTile3', oy=OY)

# floating blocks, each its own square like the original's
BRICK, QBLOCK = 0, 22
for q, r, f in [(6, 11, QBLOCK), (10, 11, BRICK), (11, 11, QBLOCK), (12, 11, BRICK),
                (13, 11, QBLOCK), (14, 11, BRICK), (12, 7, QBLOCK)]:
    c.blit('sprTile3', X(q) + 8, Y(r) + 8, f)

# the gem knocked out of the block
c.blit('sprGemL', X(11) + 8, Y(11) - 16, 0)

# Welltaro, fist up under the block
x0, y0, x1, y1 = bbox('sprPlayerAir', 1)
c.blit('sprPlayerAir', X(11) + 7, Y(12) - y0 + 1, 1)

# the Goomba and the Koopa
stand(c, 'sprEnmSlime', 134, GROUND, 1)
stand(c, 'sprGroundedTurtleWalk', 250, GROUND, 2, flip=True)

# the warp pipe is a well: the opening scene's stone well, narrowed to pipe
# width (cap wider than the shaft) with the light inside blanked out
well, _ = frame('sprWell')
pipe = np.concatenate([well[:, 16:64], well[:, 100:148]], 1).copy()
pipe[18:, 30:58] = (*BG, 255)
WELL_X, CAP = 318, GROUND - 40
stand(c, 'sprSporenIdle', WELL_X, CAP + 6, 0, second=FG)
c.paste(pipe, WELL_X - 48, CAP - 2)

# hard-block stairs, the flagpole and the castle
for k, height in enumerate((1, 2, 3)):
    for h in range(height):
        c.blit('sprPillar', X(24 + k) + 8, GROUND - 8 - 16 * h)
POLE_X, POLE_TOP = X(28) + 8, Y(4)
c.blit('sprPillar', POLE_X, GROUND - 8)
c.px[POLE_TOP:GROUND - 16, POLE_X - 1:POLE_X + 1] = FG
c.blit('sprGemM', POLE_X, POLE_TOP - 4, 0)
for i in range(14):                       # the pennant, flying left
    c.px[POLE_TOP + 4 + i // 2:POLE_TOP + 18 - (i + 1) // 2, POLE_X - 2 - i] = ACCENT
c.blit('sprHardSkull', POLE_X - 8, POLE_TOP + 10)

# HUD, laid out like the original's top line
for x, top, bottom in [(28, 'WELLTARO', '001200'), (196, '', 'x23'), (304, 'WORLD', '1-1'), (408, 'TIME', '365')]:
    text(c, top, x, 12)
    text(c, bottom, x, 24)
c.blit('sprGemS', 186, 29, 0)

c.save(sys.argv[1], 4)
