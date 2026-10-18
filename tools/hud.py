from compose import Canvas, text, frame, FG, ACCENT, BG
import numpy as np


def hp_gauge(c, x, y, hp=4, cap=4):
    c.blit('sprPcHudHpGauge', x, y, 0)
    inner_w = 80  # columns 4..83 of the gauge's top box, rows 5..10
    fill = inner_w * hp // cap
    c.px[y + 5:y + 11, x + 4:x + 4 + fill] = ACCENT
    text(c, f'{hp}/{cap}', x + 44, y + 3, align='center', shadow=BG)


def gems(c, x, y, count):
    c.blit('sprHudCurrency', x, y, 0)
    text(c, str(count), x - 14, y - 6, align='right')


def ammo(c, x, y, count, cap=8):
    """Gunboot charges as slanted white cells stacked up the gauge, the slant
    taken from sprPcHudStammoBar (3 px of drop across its 12 px)."""
    c.blit('sprPcHudStammoGauge', x, y, 0)
    step = 22
    bottom = y + 190
    for k in range(min(count, cap)):
        base = bottom - k * step
        for dx in range(12):
            slant = dx * 3 // 11
            c.px[base - step + 5 + slant:base + slant, x + 4 + dx] = FG
    text(c, str(count), x + 10, y + 199, align='center', shadow=ACCENT)
