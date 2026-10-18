-- Downwell window chrome.
--
-- Replaces default/themed/hyprland.lua.tpl entirely (Omarchy skips a template
-- whose output already exists), so the border colors are restated here rather
-- than inherited. Keep them in sync with colors.toml.
--
-- Downwell draws three colors and nothing in between: a solid gunboot-red
-- border, square corners, and a hard offset drop shadow with no blur, the way
-- the game's HUD boxes and headings sit on their shadows.

local active_border_color = "rgba(f90000ff)"
local inactive_border_color = "rgba(4d4d4d99)"

hl.config({
  general = {
    col = {
      active_border = active_border_color,
      inactive_border = inactive_border_color,
    },
  },

  group = {
    col = {
      border_active = active_border_color,
      border_inactive = inactive_border_color,
    },
  },

  decoration = {
    rounding = 0,

    shadow = {
      enabled = true,
      sharp = true,
      range = 1,
      offset = "6 6",
      color = "rgba(000000ff)",
      color_inactive = "rgba(000000aa)",
    },
  },
})
