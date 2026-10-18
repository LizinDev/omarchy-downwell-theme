import sys
sys.path.insert(0, sys.argv[0].rsplit('/', 1)[0])
from compose import Canvas, frame, ACCENT, FG
import numpy as np
c = Canvas(480, 270)
img, _ = frame('sprBgWell')
c.paste(img[8:278, 14:494], 0, 0)
# DOWNWELL with the accent under-stroke the game puts on its headings
title, (ox, oy) = frame('sprTitle')
white = (title[..., 3] > 0) & (title[..., 0] > 128) & (title[..., 1] > 128)
for dy, col in ((2, ACCENT), (0, FG)):
    layer = np.zeros_like(title)
    layer[white] = (*col, 255)
    c.paste(layer, 240 - ox, 84 - oy + dy)
c.blit('sprPlayerAir', 240, 186, 1)
c.save(sys.argv[1], 4)
