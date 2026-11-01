// Downwell Gunboots' worker: keeps the companion in step with the Omarchy theme.
//
// The theme-set hook (tools/chromium-hook) rewrites this extension's folder in
// place: art/ for the current theme, manifest.json, and state.json last. The
// worker never reloads the extension to pick that up: a reloaded unpacked
// extension is disabled unless developer mode is on. Instead the new tab page
// and the popup read art/ and state.json fresh each time they open, and the
// worker re-registers the page tint whenever state.json's stamp moves. The
// manifest (with or without the new tab page) counts from the next start.

import { getSettings } from './lib/settings.js';

async function readJSON(path) {
  try {
    const response = await fetch(chrome.runtime.getURL(path), { cache: 'no-store' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

// The page tint: one content script per part (a stylesheet, and for the
// cursors a script too), registered for every site while the theme is on and
// the part is switched on. The stylesheets are named per theme, so a theme
// switch registers new files.
async function tint(state, art) {
  const settings = await getSettings();
  const parts = art?.tints ?? {};
  const want = state.active ? Object.keys(parts).filter((id) => settings[id]) : [];
  const scripts = await chrome.scripting.getRegisteredContentScripts();
  const { tintStamp } = await chrome.storage.local.get('tintStamp');
  const fresh = tintStamp !== state.stamp;
  const files = (part) => JSON.stringify([part?.css ?? [], part?.js ?? []]);
  const drop = scripts
    .filter((s) => fresh || !want.includes(s.id) || files(s) !== files(parts[s.id]))
    .map((s) => s.id);
  if (drop.length) await chrome.scripting.unregisterContentScripts({ ids: drop });
  const kept = scripts.map((s) => s.id).filter((id) => !drop.includes(id));
  const add = want.filter((id) => !kept.includes(id));
  if (add.length) {
    await chrome.scripting.registerContentScripts(add.map((id) => ({
      id, ...parts[id], matches: ['<all_urls>'], allFrames: true, runAt: 'document_start',
    })));
  }
  if (fresh) await chrome.storage.local.set({ tintStamp: state.stamp });
}

// Is the theme Chromium has loaded the one the hook installed? It is not when
// Chromium started under another Omarchy theme (the color policy blocks theme
// extensions at startup) or before a rebuild: then only a restart helps. The
// same goes for this extension's own manifest: one started asleep lacks the
// new tab page and the shop, and an update may bring new permissions.
async function check(state, art) {
  let status;
  const base = { theme: state.theme, title: state.title };
  if (!state.active) {
    status = { ...base, state: 'asleep' };
  } else if (!state.policyCleared) {
    status = { ...base, state: 'policy' };
  } else {
    const [theme, disk] = await Promise.all([
      chrome.management.get(state.themeId).catch(() => null), readJSON('manifest.json'),
    ]);
    const loaded = chrome.runtime.getManifest();
    const same = (key) => Boolean(loaded[key]) === Boolean(disk?.[key]);
    const ok = theme?.enabled && theme.version === state.themeVersion &&
      loaded.version === disk?.version && same('chrome_url_overrides') && same('side_panel');
    status = { ...base, state: ok ? 'ok' : 'restart' };
  }
  await chrome.storage.session.set({ status });

  const warn = status.state === 'restart' || status.state === 'policy';
  await chrome.action.setBadgeText({ text: warn ? '!' : '' });
  if (art) await chrome.action.setBadgeBackgroundColor({ color: art.palette.accent });

  const { notified } = await chrome.storage.local.get('notified');
  if (status.state === 'restart' && notified !== state.stamp) {
    await chrome.storage.local.set({ notified: state.stamp });
    chrome.notifications.create(`restart-${state.stamp}`, {
      type: 'basic',
      iconUrl: 'art/icon-128.png',
      title: state.title,
      message: `Restart Chromium to put on ${state.title}: open chrome://restart`,
    });
  }
  return status;
}

async function sync() {
  const [state, art] = await Promise.all([readJSON('state.json'), readJSON('art/theme.json')]);
  if (!state) return { state: 'ok', theme: '', title: art?.title ?? '' };
  await tint(state, art);
  return check(state, art);
}

// ---- downloads ----------------------------------------------------------

// The game's sounds, from a page kept offscreen for them: a worker has no audio.
async function play(name, volume) {
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html', reasons: ['AUDIO_PLAYBACK'], justification: "the theme's game sounds",
    }).catch(() => {});
  }
  chrome.runtime.sendMessage({ type: 'play', name, volume }).catch(() => {});
}

// A finished download is a gem picked up; a failed one, a hit.
async function downloaded(delta) {
  const ended = delta.state?.current;
  if (ended !== 'complete' && ended !== 'interrupted') return;
  const [settings, state, item] = await Promise.all([
    getSettings(), readJSON('state.json'), chrome.downloads.search({ id: delta.id }).then((r) => r[0]),
  ]);
  if (!settings.downloads || state?.active === false || !item) return;
  if (ended === 'interrupted' && item.error === 'USER_CANCELED') return;
  const name = item.filename.split('/').pop() || item.url;
  const done = ended === 'complete';
  chrome.notifications.create(`download-${item.id}`, {
    type: 'basic',
    iconUrl: done ? 'art/notify-done.png' : 'art/notify-failed.png',
    title: done ? 'GEM GET!' : 'OUCH! DOWNLOAD LOST',
    message: done ? name : `${name}: ${item.error.toLowerCase().replaceAll('_', ' ')}`,
  });
  if (settings.sound) play(done ? 'gem' : 'back', 0.5);
}

async function start() {
  if (!(await chrome.alarms.get('sync'))) chrome.alarms.create('sync', { periodInMinutes: 0.5 });
  await sync();
}

chrome.runtime.onInstalled.addListener(start);
chrome.runtime.onStartup.addListener(start);
chrome.alarms.onAlarm.addListener((alarm) => alarm.name === 'sync' && sync());
chrome.tabs.onCreated.addListener(() => sync());
chrome.windows.onFocusChanged.addListener((id) => id !== chrome.windows.WINDOW_ID_NONE && sync());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) sync();
});
chrome.downloads.onChanged.addListener(downloaded);
chrome.notifications.onClicked.addListener((id) => {
  if (id.startsWith('download-')) chrome.downloads.show(Number(id.slice(9)));
  if (id.startsWith('restart-') || id.startsWith('download-')) chrome.notifications.clear(id);
});
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'open-shop' && tab) chrome.sidePanel.open({ windowId: tab.windowId });
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'sync') return false;
  sync().then(reply, () => reply(null));
  return true;
});
