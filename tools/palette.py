"""The theme's three Downwell roles, read from ../colors.toml: the field
(background), the ink (bright_foreground) and the accent."""
import re
from pathlib import Path

THEME = Path(__file__).resolve().parent.parent


def _keys():
    keys = {}
    for line in (THEME / 'colors.toml').read_text().splitlines():
        m = re.match(r'\s*([A-Za-z0-9_-]+)\s*=\s*"(#[0-9a-fA-F]{6})"', line)
        if m:
            keys[m.group(1)] = tuple(int(m.group(2)[i:i + 2], 16) for i in (1, 3, 5))
    return keys


KEYS = _keys()
BG = KEYS['background']
FG = KEYS['bright_foreground']
ACCENT = KEYS['accent']
BLUE = KEYS['blue']
