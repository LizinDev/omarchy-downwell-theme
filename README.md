# Downwell

A dark theme for [Omarchy](https://omarchy.org) 4 (Quattro) in the original palette of
[Downwell](https://downwellgame.com): black, white, and one red. An unofficial fan theme;
Downwell is by Moppin, published by Devolver Digital.

The game draws everything in three colors and nothing in between, so the theme does too
wherever it can: a solid red window border with square corners and a hard, unblurred
drop shadow, opaque menus, and the chosen row framed in red the way the game boxes its
selection. Its sister theme, [Downwell Nikaido](https://github.com/LizinDev/omarchy-downwell-nikaido-theme),
uses the game's orange "Nikaido" palette.

![preview](preview.png)

## Install

```bash
omarchy theme install https://github.com/LizinDev/omarchy-downwell-theme.git
```

## Palette

| Role | Hex | |
|---|---|---|
| background | `#050505` | the game's black: terminals, bar, popups, menus |
| foreground | `#e9e9e9` | body text, 16.79:1 on background |
| bright_foreground | `#f9f9f9` | the game's white: cursor, sprites |
| accent | `#f90000` | the game's red: borders, selected rows, shortcuts |
| selection | `#3a0f0f` | text selection, btop meters |
| muted | `#4d4d4d` | the game's grey: ANSI bright-black, dividers |

ANSI: `#ff6b6b` red · `#66b400` green · `#f2d03f` yellow · `#1f86f9` blue ·
`#d84fc0` magenta · `#2fc8d0` cyan · `#fe9300` orange. Green is the game's "Matcha"
palette, blue its secondary, orange its "Nikaido" accent.

The accent is the red, so the `red` key cannot be: it draws the wrong-password border
and error text, and a focused window must not look like a failed login. `red` is the
lighter salmon `#ff6b6b` (the game's own "Vboy" secondary), 44.9 dE from the accent.

Saturation is deliberately high. Downwell is one fully saturated color on black, so the
accent stays at 100% and the ANSI colors sit a step below it.

## What's here

| File | |
|---|---|
| `colors.toml` | the palette, which generates 17 app configs on its own |
| `hyprland.lua` | solid red border, square corners, hard offset shadow |
| `shell.{menu,launcher,tooltip,lock}.toml` | opaque cards, red selection frame, darker scrim |
| `icons.theme` | `Yaru-red-dark` |
| `backgrounds/` | see below |
| `preview.png` | theme-switcher tile, a pixel-art palette specimen |
| `unlock.png` | Plymouth boot splash and SDDM logo |
| `tools/` | the scripts that build the backgrounds, previews and shell overrides |

## Backgrounds

Only `4-dither.png` ships: the palette's three bands joined by ordered dither, generated
from `colors.toml`. The other six are built from Downwell's own art and stay local. Every
one uses exactly the theme's three colors:

| | |
|---|---|
| `1-clouds.png` | the cloud sea and heart balloon, repainted in this palette's three colors |
| `2-well.png` | a well shaft built from the game's tiles, enemies, gems and HUD |
| `3-title.png` | the DOWNWELL logo over the opening backdrop |
| `5-bros.png` | Super Welltaro Bros.: World 1-1 with gem ? blocks, a slime Goomba, a turtle Koopa and the stone well as the warp pipe |
| `6-terra.png` | Terrawell: a Terraria-style cross-section with the bucket well, the shopkeeper as the Guide, a torchlit tunnel, gem ore and a hotbar |
| `7-isaac.png` | The Welling of Isaac: a basement room with four doors, bubble tears at a fly swarm, a heart pedestal, a tinted gem rock and the minimap |

With your own copy of the game (Steam) and the Omarchywell project checked out at
`~/Projects/Downwell`, rebuild them from `colors.toml`:

```bash
tools/build-backgrounds.sh ~/Projects/Downwell/Wallpaper.png   # omit the argument to skip 1-clouds
```

The scripts read the game's sprites read-only through Omarchywell's
`tools/game_sprites.py`, swap black/white/red for this theme's background, white and
accent (the game's secondary blues and greens fold into the accent or the white), and
scale them 4× on an integer pixel grid.

## Caveats

**Installed from a git clone, this theme loses `hyprland.lua`.** Omarchy drops every
`.lua`, terminal config and `vscode.json` from a cloned theme. The palette and border
color survive (they live in `colors.toml`), but not the square corners and hard shadow.

**`shell.*.toml` overrides replace their whole section.** Their hex values are frozen
copies of `colors.toml`. After changing the palette, apply the theme, run
`python3 tools/shell-overrides.py`, then `omarchy theme refresh`.

## Working on it

Keep the repo outside `~/.config/omarchy/themes` and symlink it in. Omarchy treats a
directory with `.git` inside as a cloned theme and stages it with restrictions; it
never treats a symlink that way.

```bash
ln -s ~/Projects/omarchy-downwell-theme ~/.config/omarchy/themes/downwell
omarchy theme set downwell
```
