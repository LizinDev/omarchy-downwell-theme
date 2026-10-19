// Settings live in storage.local and follow the companion across theme
// switches; status is the worker's last check of the theme, in storage.session.

export const DEFAULTS = {
  sound: false,      // the game's menu sounds when you choose and pick
  scrollbars: true,  // page scrollbars in the accent
  selection: true,   // selected text on pages in the accent
  favicons: true,    // shortcut icons repainted in the three palette colors
  clock24: true,
};

export const OPTIONS = [
  ['sound', 'SOUND'],
  ['scrollbars', 'SCROLLBARS'],
  ['selection', 'SELECTION'],
  ['favicons', 'TINT ICONS'],
  ['clock24', '24H CLOCK'],
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
