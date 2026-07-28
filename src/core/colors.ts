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
    id: "rainbow",
    label: "Rainbow",
    colorFor: (i, n) => {
      const hue = (i / Math.max(1, n - 1)) * 300;
      return `hsl(${hue}, 85%, 58%)`;
    },
  },
  {
    id: "viridis",
    label: "Viridis",
    colorFor: (i, n) => viridisGradient(i / Math.max(1, n - 1)),
  },
  {
    id: "sunset",
    label: "Sunset",
    colorFor: (i, n) => sunsetGradient(i / Math.max(1, n - 1)),
  },
  {
    id: "grayscale",
    label: "Grayscale",
    colorFor: (i, n) => {
      const l = lerp(12, 92, i / Math.max(1, n - 1));
      return `hsl(0, 0%, ${l}%)`;
    },
  },
];

export function getColorScheme(id: string): ColorScheme {
  return COLOR_SCHEMES.find((s) => s.id === id) ?? COLOR_SCHEMES[0];
}
