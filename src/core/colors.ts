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

const TRIAL_MIN_LIGHTNESS = 0.3;
const TRIAL_MAX_LIGHTNESS = 0.7;

/**
 * Normalizes a colorFor() output for the follow-card ("trial") viz: full
 * saturation, and lightness linearly remapped from [0, 1] to
 * [TRIAL_MIN_LIGHTNESS, TRIAL_MAX_LIGHTNESS]. Some scheme endpoints are too
 * dark to read against the viz's near-black background (e.g. Sunset's
 * start) while others are too light to read as "solid" color (e.g.
 * Viridis's end); clamping every color to a mid-brightness band fixes both.
 * Grayscale colors (s === 0) keep their hue-less saturation so the scheme
 * stays achromatic, but still get the lightness remap.
 */
export function toFullSaturation(color: string): string {
  const { h, s, l } = parseToHsl(color);
  const mappedL = TRIAL_MIN_LIGHTNESS + l * (TRIAL_MAX_LIGHTNESS - TRIAL_MIN_LIGHTNESS);
  const finalS = s === 0 ? 0 : 100;
  return `hsl(${h}, ${finalS}%, ${mappedL * 100}%)`;
}
