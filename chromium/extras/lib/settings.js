// Settings live in storage.local and follow the companion across theme
// switches; status is the worker's last check of the theme, in storage.session.

export const DEFAULTS = {
  sound: false,      // the game's menu sounds when you choose and pick
  scrollbars: true,  // page scrollbars in the accent
  selection: true,   // selected text on pages in the accent
  cursors: true,     // the game's cursors on pages
  focus: true,       // keyboard focus rings on pages in the accent
  favicons: true,    // shortcut icons repainted in the three palette colors
  downloads: true,   // a notification (and with sound, the gem sound) when a download ends
  gameover: true,    // a page that fails to load shows the game's death screen
  groups: false,     // new tab groups take the accent's color (overrides the one Chromium picks)
  gems: true,        // today's pages, as gems, in the pause menu
  clock24: true,
};

// key, label, and the upgrade whose icon stands for it in the popup
export const OPTIONS = [
  ['sound', 'SOUND', 'sUgDrone'],
  ['scrollbars', 'SCROLLBARS', 'sUgSuperBtry'],
  ['selection', 'SELECTION', 'sUgStraightShooter'],
  ['cursors', 'CURSORS', 'sUgLaserSight'],
  ['focus', 'FOCUS RINGS', 'sUgZen'],
  ['favicons', 'TINT ICONS', 'sUgAlchemy'],
  ['downloads', 'DOWNLOADS', 'sUgGemAttractor'],
  ['gameover', 'GAME OVER', 'sUgRIP'],
  ['groups', 'TAB GROUPS', 'sUgChainReaction'],
  ['gems', 'GEM COUNT', 'sUgFortune'],
  ['clock24', '24H CLOCK', 'sUgTime'],
];

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...settings };
}

export async function setSetting(key, value) {
  const settings = await getSettings();
  settings[key] = value;
  await chrome.storage.local.set({ settings });
  return settings;
}

// ok | restart (Chromium has an older build of the theme, or none) |
// policy (Omarchy's browser color policy is still in place) | asleep
// (the Omarchy theme has no Chromium theme). `theme` names the Omarchy theme.
export async function getStatus() {
  const { status } = await chrome.storage.session.get('status');
  return status ?? { state: 'ok', theme: '' };
}
