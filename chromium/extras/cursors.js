// Downwell Gunboots, on every page while the cursors are on: the stylesheet
// draws the game's cursors on links, buttons and text fields, but a page can
// ask for an arrow, a hand or an I-beam on any element of its own. Mark the
// one under the pointer when it does, for the stylesheet's last rules; only
// that element, and only while the pointer is on it.

(() => {
  const ATTR = 'data-gunboots-cursor';
  const KINDS = { default: 'arrow', pointer: 'hand', text: 'text' };
  let marked = null;
  addEventListener('pointerover', (e) => {
    const el = e.target;
    if (el === marked || !(el instanceof Element)) return;
    marked?.removeAttribute(ATTR);
    marked = null;
    const kind = KINDS[getComputedStyle(el).cursor];
    if (kind) {
      el.setAttribute(ATTR, kind);
      marked = el;
    }
  }, { capture: true, passive: true });
})();
