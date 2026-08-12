import type { Theme } from "./theme";

/**
 * A color scheme maps a card's ORIGINAL position (before any shuffling) to a
 * color. Because color always follows the card's original index, watching
 * the colors scatter across columns is exactly watching the deck randomize.
 */
export interface ColorScheme {
  id: string;
  label: string;
  colorFor(originalIndex: number, deckSize: number): string;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolates through a list of [r,g,b] stops spaced evenly over [0,1]. */
function stopGradient(stops: Array<[number, number, number]>) {
  return (t: number): string => {
    const clamped = Math.min(1, Math.max(0, t));
    const segments = stops.length - 1;
    const scaled = clamped * segments;
    const i = Math.min(segments - 1, Math.floor(scaled));
    const localT = scaled - i;
    const [r0, g0, b0] = stops[i];
    const [r1, g1, b1] = stops[i + 1];
    const r = Math.round(lerp(r0, r1, localT));
    const g = Math.round(lerp(g0, g1, localT));
    const b = Math.round(lerp(b0, b1, localT));
    return `rgb(${r}, ${g}, ${b})`;
  };
}

const viridisGradient = stopGradient([
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
]);

const sunsetGradient = stopGradient([
  [42, 32, 84],
  [124, 40, 122],
  [219, 71, 100],
  [255, 145, 78],
  [255, 227, 130],
]);

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: "viridis",
    label: "Viridis",
    colorFor: (i, n) => viridisGradient(i / Math.max(1, n - 1)),
  },
  {
    id: "rainbow",
    label: "Rainbow",
    colorFor: (i, n) => {
      const hue = (i / Math.max(1, n - 1)) * 300;
      return `hsl(${hue}, 85%, 58%)`;
    },
  },
  {
    id: "grayscale",
    label: "Grayscale",
    colorFor: (i, n) => {
      const l = lerp(12, 92, i / Math.max(1, n - 1));
      return `hsl(0, 0%, ${l}%)`;
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    colorFor: (i, n) => sunsetGradient(i / Math.max(1, n - 1)),
  },
];

export function getColorScheme(id: string): ColorScheme {
  return COLOR_SCHEMES.find((s) => s.id === id) ?? COLOR_SCHEMES[0];
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

function parseToHsl(color: string): { h: number; s: number; l: number } {
  const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch.slice(1, 4).map((v) => Number(v) / 255);
    return rgbToHsl(r, g, b);
  }
  const hslMatch = color.match(/^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/);
  if (hslMatch) {
    return { h: Number(hslMatch[1]), s: Number(hslMatch[2]) / 100, l: Number(hslMatch[3]) / 100 };
  }
  throw new Error(`Unsupported color format: ${color}`);
}

/**
 * The follow-card viz blends colors over the page's `--bg`, so the safe
 * lightness band depends on which theme that is: dark mode's near-black
 * background wants colors pulled up towards mid-brightness, while light
 * mode's near-white background wants them pulled down, or a faint (low
 * alpha) cell would wash out into the background either way.
 */
const TRIAL_LIGHTNESS_BAND: Record<Theme, [number, number]> = {
  dark: [0.3, 0.7],
  light: [0.22, 0.5],
};

/**
 * Normalizes a colorFor() output for the follow-card ("trial") viz: full
 * saturation, and lightness linearly remapped from [0, 1] to the current
 * theme's TRIAL_LIGHTNESS_BAND. Some scheme endpoints are too dark to read
 * against a dark background (e.g. Sunset's start) while others are too
 * light to read as "solid" color (e.g. Viridis's end); clamping every color
 * to a mid-brightness band fixes both, in either theme. Grayscale colors
 * (s === 0) keep their hue-less saturation so the scheme stays achromatic,
 * but still get the lightness remap.
 */
export function toFullSaturation(color: string, theme: Theme): string {
  const { h, s, l } = parseToHsl(color);
  const [minLightness, maxLightness] = TRIAL_LIGHTNESS_BAND[theme];
  const mappedL = minLightness + l * (maxLightness - minLightness);
  const finalS = s === 0 ? 0 : 100;
  return `hsl(${h}, ${finalS}%, ${mappedL * 100}%)`;
}
