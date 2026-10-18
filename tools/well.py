import sys
sys.path.insert(0, sys.argv[0].rsplit('/', 1)[0])
from compose import Canvas, tiles, frame
from hud import hp_gauge, gems, ammo
import numpy as np

def bbox(name, i=0):
    img, (ox, oy) = frame(name, i)
    ys, xs = np.nonzero(img[..., 3])
    return xs.min() - ox, ys.min() - oy, xs.max() - ox, ys.max() - oy

c = Canvas(480, 270)
OX = -8
L, R = 10, 20
blocks = {(11, 3), (12, 3), (11, 4),
          (19, 7), (18, 7), (19, 8),
          (11, 13), (12, 13), (13, 13), (11, 14)}
breakable = {(14, 10): 16, (15, 10): 17, (16, 10): 22}
def solid(q, r):
    if q < L or q > R:
        return 'hidden'
    if q in (L, R):
        return True
    return (q, r) in blocks or (q, r) in breakable
tiles(c, solid, ox=OX, special=breakable)
X = lambda q: OX + q * 16
# thin platform hanging off the right wall
for q in (17, 18, 19):
    c.blit('sprTile1', X(q) + 8, 15 * 16 + 8, 23)

def stand(name, x, top, i=0, flip=False):
    x0, y0, x1, y1 = bbox(name, i)
    c.blit(name, x, top - 1 - y1, i, flip)

stand('sprTurtle', X(12) + 2, 3 * 16, 0)
stand('sprTurtle', X(12), 13 * 16, 2, True)
c.blit('sprBat', 286, 74, 1, True)
c.blit('sprEnmJelly', 206, 186, 0)
c.blit('sprEnmSnail', X(20) - 10, 160, 0)
for x, y, n, i in [(206, 34, 'sprGemM', 0), (276, 22, 'sprGemS', 1), (292, 136, 'sprGemS', 2),
                   (240, 226, 'sprGemL', 0), (270, 246, 'sprGemS', 0), (196, 108, 'sprGemS', 3)]:
    c.blit(n, x, y, i)
# the hero, falling and firing the gunboots
c.blit('sprPlayerAir', 244, 104, 0)
c.blit('sprBullet1', 244, 132, 0, rot=1)
c.blit('sprBullet1', 244, 152, 0, rot=1)
hp_gauge(c, 52, 16, 3, 4)
gems(c, 452, 26, 128)
ammo(c, 338, 40, 6)
c.save(sys.argv[1], 4)
