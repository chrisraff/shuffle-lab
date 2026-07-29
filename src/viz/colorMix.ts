import type { ColorScheme } from "../core/colors";

let probeCtx: CanvasRenderingContext2D | null = null;

function getProbeContext(): CanvasRenderingContext2D {
  if (!probeCtx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    probeCtx = canvas.getContext("2d", { willReadFrequently: true })!;
  }
  return probeCtx;
}

/** Parses any valid CSS color string (hsl(), rgb(), ...) to [r, g, b] via the browser's own color parser. */
export function parseColorToRgb(color: string): [number, number, number] {
  const ctx = getProbeContext();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

/** Precomputes the RGB triple for every original card index under a color scheme, as a flat [r,g,b,r,g,b,...] table. */
export function buildColorTable(colorScheme: ColorScheme, deckSize: number): Float64Array {
  const table = new Float64Array(deckSize * 3);
  for (let i = 0; i < deckSize; i++) {
    const [r, g, b] = parseColorToRgb(colorScheme.colorFor(i, deckSize));
    table[i * 3] = r;
    table[i * 3 + 1] = g;
    table[i * 3 + 2] = b;
  }
  return table;
}
