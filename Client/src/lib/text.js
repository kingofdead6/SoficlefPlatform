/**
 * Split an element's text into per-character spans so each glyph can be animated on its
 * own, returning the spans in document order.
 *
 * Two things this does that a naive split does not:
 *
 *  - The original text is preserved on `data-text` and mirrored into an aria-label, so the
 *    word still reads as one word to assistive technology instead of being announced
 *    letter by letter.
 *  - Spaces become non-breaking and are left out of the returned list — animating a space
 *    achieves nothing, and including it would throw off a stagger's timing.
 *
 * Idempotent: calling it twice on the same element re-splits from the stored original
 * rather than splitting the spans it already made.
 */
export function splitChars(element) {
  if (!element) return [];

  const original = element.dataset.text ?? element.textContent ?? '';
  if (!original) return [];

  element.dataset.text = original;
  element.setAttribute('aria-label', original);
  element.textContent = '';

  const chars = [];
  for (const character of original) {
    const span = document.createElement('span');

    if (character === ' ') {
      span.innerHTML = '&nbsp;';
      span.style.display = 'inline-block';
      // Not pushed: a space has nothing to reveal, and counting it would skew the stagger.
      element.appendChild(span);
      continue;
    }

    span.textContent = character;
    span.style.display = 'inline-block';
    span.style.willChange = 'transform, opacity';
    // The glyphs are decorative once aria-label carries the word.
    span.setAttribute('aria-hidden', 'true');
    element.appendChild(span);
    chars.push(span);
  }

  return chars;
}
