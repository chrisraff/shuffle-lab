import type { OperationKind } from "../core/operations";
import { OPERATION_ICON_SVG, OPERATION_LABEL } from "./icons";

/**
 * Shared pixel geometry for the deck grids (row = position in the deck,
 * column = shuffle count) so every grid-based visualization lines up and
 * reads the same way.
 */
export const CELL_WIDTH = 22;
/** Header holds a small operation icon above a column-index number. */
export const HEADER_HEIGHT = 30;
export const ICON_SIZE = 13;

export function computeCellHeight(deckSize: number): number {
  return Math.max(2, Math.min(10, Math.round(420 / deckSize)));
}

/**
 * Creates and sizes a devicePixelRatio-aware canvas for a `columns` x
 * `deckSize` grid, with column-index labels drawn along the top.
 * `labelColumns` (defaults to `columns`) caps how many of those columns get
 * a number label — used to reserve extra blank width during an animation
 * without numbering a column that doesn't exist yet.
 */
export function createGridCanvas(
  columns: number,
  deckSize: number,
  labelColumns: number = columns,
): { canvas: HTMLCanvasElement; gfx: CanvasRenderingContext2D; cellHeight: number } {
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
  for (let c = 0; c < labelColumns; c++) {
    gfx.fillText(String(c), c * CELL_WIDTH + CELL_WIDTH / 2, HEADER_HEIGHT - 4);
  }

  return { canvas, gfx, cellHeight };
}

/** Matches style.css's `@media (max-width: 760px)` breakpoint. */
const MOBILE_BREAKPOINT_PX = 760;

/**
 * On mobile, uniformly scales `stage` (a `.deck-grid-wrap`/`.deck-grid-stage`
 * holding a grid canvas + its icon row) so its natural height exactly fills
 * `container`'s available height — shrinking a tall grid to fit a short
 * viewport, or growing a short one to use the full height, so the panel
 * never needs to scroll vertically. On wider viewports this is a no-op: the
 * grid keeps its natural pixel size and the panel scrolls instead. Callers
 * re-run this after every render, since the grid's natural size changes
 * with deck size / shuffle count / trial count.
 */
export function fitStageToContainer(stage: HTMLElement, container: HTMLElement): void {
  stage.style.transform = "none";
  if (window.innerWidth > MOBILE_BREAKPOINT_PX) return;

  const naturalHeight = stage.getBoundingClientRect().height;
  const availableHeight = container.clientHeight;
  if (naturalHeight <= 0 || availableHeight <= 0) return;
  stage.style.transform = `scale(${availableHeight / naturalHeight})`;
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

/**
 * An absolutely-positioned row of small icons, one per column, showing
 * which operation produced that column (column 0 — the unshuffled deck —
 * never gets one). Meant to sit inside a `position: relative` stage on top
 * of a grid canvas built with the same `columns` count.
 */
export function buildStepIconRow(columns: number, getKind: (col: number) => OperationKind | null): HTMLElement {
  const row = document.createElement("div");
  row.className = "grid-icon-row";
  for (let c = 0; c < columns; c++) {
    const kind = getKind(c);
    if (!kind) continue;
    const cell = document.createElement("div");
    cell.className = "grid-icon-cell";
    cell.style.left = `${c * CELL_WIDTH}px`;
    cell.style.width = `${CELL_WIDTH}px`;
    cell.style.height = `${ICON_SIZE}px`;
    cell.title = OPERATION_LABEL[kind];
    cell.innerHTML = OPERATION_ICON_SVG[kind];
    row.appendChild(cell);
  }
  return row;
}
