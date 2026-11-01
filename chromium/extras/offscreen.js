// The worker cannot play audio; it opens this page offscreen to play the
// game's sounds for events with no page of their own (a finished download).

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'play') return false;
  const voice = new Audio(chrome.runtime.getURL(`art/sounds/${message.name}.wav`));
  voice.volume = message.volume ?? 0.5;
  voice.play().catch(() => {});
  return false;
});
