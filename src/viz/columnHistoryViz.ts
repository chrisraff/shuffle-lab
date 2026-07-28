import type { Trial } from "../core/experiment";
import type { ColorScheme } from "../core/colors";
import type { VizContext, VizRenderOptions, Visualization } from "./types";

const CELL_WIDTH = 22;
const HEADER_HEIGHT = 18;
const MAX_VISIBLE_TRIALS = 12;

/**
 * The primary sandbox visualization: each trial (deck) is drawn as a grid
 * where column 0 is the unshuffled deck, column k is the deck after k
 * shuffles, and each cell's color is the card's ORIGINAL position. Watching
 * the color pattern break up left-to-right is watching the deck randomize.
 */
export class ColumnHistoryViz implements Visualization {
  id = "column-history";
  label = "Column History";
  description =
    "Each column is the deck after N shuffles. Row = position in the deck, color = the card's original position.";

  private container: HTMLElement | null = null;
  private trialsEl: HTMLElement | null = null;

  mount(container: HTMLElement, ctx: VizContext): void {
    this.container = container;
    container.innerHTML = `
      <div class="viz-header">
        <h2>${this.label}</h2>
        <p class="viz-desc">${this.description}</p>
      </div>
      <div class="column-history-trials"></div>
    `;
    this.trialsEl = container.querySelector<HTMLElement>(".column-history-trials");
    this.render(ctx);
  }

  render(ctx: VizContext, _options?: VizRenderOptions): void {
    if (!this.trialsEl) return;
    const { experiment, colorScheme } = ctx;

    this.trialsEl.innerHTML = "";

    if (experiment.trials.length > MAX_VISIBLE_TRIALS) {
      const note = document.createElement("div");
      note.className = "viz-note";
      note.textContent = `Showing ${MAX_VISIBLE_TRIALS} of ${experiment.trials.length} decks. Try the "Follow One Card" visualization to see all trials aggregated at once.`;
      this.trialsEl.appendChild(note);
    }

    const showLabels = experiment.trials.length > 1;
    experiment.trials.slice(0, MAX_VISIBLE_TRIALS).forEach((trial, trialIndex) => {
      this.trialsEl!.appendChild(
        renderTrialGrid(trial, trialIndex, experiment.deckSize, colorScheme, showLabels),
      );
    });
  }

  unmount(): void {
    if (this.container) this.container.innerHTML = "";
    this.container = null;
    this.trialsEl = null;
  }
}

function renderTrialGrid(
  trial: Trial,
  trialIndex: number,
  deckSize: number,
  colorScheme: ColorScheme,
  showLabel: boolean,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "deck-grid-wrap";

  if (showLabel) {
    const label = document.createElement("div");
    label.className = "deck-grid-label";
    label.textContent = `Deck ${trialIndex + 1}`;
    wrap.appendChild(label);
  }

  const canvas = document.createElement("canvas");
  const cols = trial.history.length;
  const cellHeight = Math.max(2, Math.min(10, Math.round(420 / deckSize)));
  const widthCss = cols * CELL_WIDTH;
  const heightCss = HEADER_HEIGHT + deckSize * cellHeight;
  const dpr = window.devicePixelRatio || 1;

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
  for (let c = 0; c < cols; c++) {
    gfx.fillText(String(c), c * CELL_WIDTH + CELL_WIDTH / 2, 12);
  }

  const cellGap = cellHeight > 3 ? 1 : 0;
  for (let c = 0; c < cols; c++) {
    const order = trial.history[c];
    for (let r = 0; r < deckSize; r++) {
      gfx.fillStyle = colorScheme.colorFor(order[r], deckSize);
      gfx.fillRect(c * CELL_WIDTH, HEADER_HEIGHT + r * cellHeight, CELL_WIDTH - 1, cellHeight - cellGap);
    }
  }

  wrap.appendChild(canvas);
  return wrap;
}
