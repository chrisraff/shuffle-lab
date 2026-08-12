/**
 * Light/dark support is otherwise pure CSS (custom properties swapped via
 * `@media (prefers-color-scheme)`, see style.css) plus an optional
 * `data-theme` attribute on `<html>` that the embed page uses to pin a
 * specific theme regardless of the OS setting. This module exists only for
 * the few things CSS can't reach on its own: canvas `fillStyle` calls and
 * the color-scheme lightness math in `core/colors.ts`, both of which need
 * the resolved theme as a plain value rather than a cascade.
 */
export type Theme = "light" | "dark";

const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

export function getSystemTheme(): Theme {
  return darkMediaQuery.matches ? "dark" : "light";
}

/** Mirrors style.css's cascade: an explicit `data-theme` on `<html>` (set once, by the embed page) wins; otherwise the OS-level preference decides. */
export function getEffectiveTheme(): Theme {
  const forced = document.documentElement.dataset.theme;
  return forced === "light" || forced === "dark" ? forced : getSystemTheme();
}

/** Fires `onChange` whenever the OS-level preference flips. Irrelevant to a page with a forced `data-theme` (that never changes mid-session), but harmless to call regardless. Returns an unsubscribe function. */
export function watchSystemTheme(onChange: () => void): () => void {
  darkMediaQuery.addEventListener("change", onChange);
  return () => darkMediaQuery.removeEventListener("change", onChange);
}
