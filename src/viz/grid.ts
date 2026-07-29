/**
 * Shared pixel geometry for the deck grids (row = position in the deck,
 * column = shuffle count) so every grid-based visualization lines up and
 * reads the same way.
 */
export const CELL_WIDTH = 22;
export const HEADER_HEIGHT = 18;

export function computeCellHeight(deckSize: number): number {
  return Math.max(2, Math.min(10, Math.round(420 / deckSize)));
}

/** Creates and sizes a devicePixelRatio-aware canvas for a `columns` x `deckSize` grid, with column-index labels drawn along the top. */
export function createGridCanvas(columns: number, deckSize: number): { canvas: HTMLCanvasElement; gfx: CanvasRenderingContext2D; cellHeight: number } {
  const cellHeight = computeCellHeight(deckSize);
  const widthCss = columns * CELL_WIDTH;
  const heightCss = HEADER_HEIGHT + deckSize * cellHeight;
  const dpr = window.devicePixelRatio || 1;

  const canvas = document.createElement("canvas");
  canvas.style.width = `${widthCss}px`;
  canvas.style.height = `${heightCss}px`;
  canvas.width = widthCss * dpr;
  canvas.height = heightCss * dpr;

  const gfx = canvas.getContext("2d")!;
  gfx.scale(dpr, dpr);
  gfx.fillStyle = "#0f1115";
  gfx.fillRect(0, 0, widthCss, heightCss);
  gfx.fillStyle = "#9aa1ac";
  gfx.font = "10px system-ui, sans-serif";
  gfx.textAlign = "center";
  for (let c = 0; c < columns; c++) {
    gfx.fillText(String(c), c * CELL_WIDTH + CELL_WIDTH / 2, 12);
  }

  return { canvas, gfx, cellHeight };
}

export function fillCell(
  gfx: CanvasRenderingContext2D,
  col: number,
  row: number,
  cellHeight: number,
  color: string,
): void {
  const cellGap = cellHeight > 3 ? 1 : 0;
  gfx.fillStyle = color;
  gfx.fillRect(col * CELL_WIDTH, HEADER_HEIGHT + row * cellHeight, CELL_WIDTH - 1, cellHeight - cellGap);
}
