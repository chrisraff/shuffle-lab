/**
 * Uniformly scales `container` so its natural (unscaled) height exactly
 * fills the available height inside its parent — shrinking a tall
 * visualization down or stretching a short one up to make full use of
 * whatever height the embedding iframe was given. "Available" respects the
 * parent's own padding (e.g. `#embed-root`'s `.panel` padding), not just
 * its raw box size, so the fitted content sits inset rather than
 * overflowing into (or past) the padding. Falls back to the viewport
 * height if `container` has no parent. Recomputed on resize.
 *
 * Width scales by the same factor (preserving the grid's aspect ratio
 * rather than distorting cells into rectangles), so the visualization can
 * end up narrower than the available space — the companion CSS in
 * `embed.css` left-aligns it (rather than centering) so any leftover width
 * just reads as the parent's own background, not an evenly split gap on
 * both sides.
 */
export function fitToHeight(container: HTMLElement): void {
  const parent = container.parentElement;

  const availableHeight = (): number => {
    if (!parent) return window.innerHeight;
    const style = getComputedStyle(parent);
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;
    return parent.clientHeight - paddingTop - paddingBottom;
  };

  const apply = (): void => {
    container.style.transform = "none";
    const naturalHeight = container.getBoundingClientRect().height;
    if (naturalHeight <= 0) return;
    const scale = availableHeight() / naturalHeight;
    container.style.transform = `scale(${scale})`;
  };
  apply();
  window.addEventListener("resize", apply);
}
