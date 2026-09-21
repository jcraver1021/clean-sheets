/**
 * Shows `hintEl` (a right-edge fade cue, see style.css) whenever `scoreEl`
 * has more content to the right than its viewport shows — otherwise
 * scrolling to see the rest of a wide score isn't discoverable. A
 * `ResizeObserver` covers content-size changes (every rerender potentially
 * changes the score's width); a `scroll` listener covers the user
 * scrolling to (or away from) the end.
 */
export function attachScrollHint(
  scoreEl: HTMLElement,
  hintEl: HTMLElement,
): void {
  function update(): void {
    const hasMoreToTheRight =
      scoreEl.scrollWidth - scoreEl.scrollLeft > scoreEl.clientWidth + 1;
    hintEl.classList.toggle("visible", hasMoreToTheRight);
  }

  new ResizeObserver(update).observe(scoreEl);
  scoreEl.addEventListener("scroll", update);
  update();
}
