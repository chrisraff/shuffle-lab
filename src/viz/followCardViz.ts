import { CELL_WIDTH, HEADER_HEIGHT, createGridCanvas } from "./grid";
import type { VizContext, VizRenderOptions, Visualization } from "./types";

const MIN_TRIALS_FOR_SMOOTH_GRADIENT = 20;
const BACKGROUND_COLOR = "#0f1115";
/**
 * Raw probability makes faint cells nearly invisible on a dark background
 * (e.g. 1/52 ≈ 2% opacity) even though the difference from "impossible" is
 * meaningful. Gamma-correcting the opacity (alpha = probability ** GAMMA)
 * keeps 0 -> 0 and 1 -> 1 but boosts everything in between, so low-but-real
 * probabilities stay legible without changing which cells are brighter.
 */
const VISIBILITY_GAMMA = 0.45;

/** The card whose position we track — the one that started on top of the deck. */
const TRACKED_CARD = 0;

/**
 * Same grid as Column History (row = position, column = shuffle count), but
 * instead of drawing one trial's actual arrangement, each cell shows the
 * TRACKED card's color averaged across every trial: a cell where the card
 * landed in, say, 100% of trials is drawn in full color, one where it
 * landed in 2% of trials is drawn as a faint wash of that color over black.
 * At 0 shuffles that's a solid color at row 0 and black everywhere else; as
 * shuffles increase the color spreads out and fades, because the tracked
 * card is only ever in one place per trial and "being averaged" with black
 * everywhere it wasn't.
 */
export class FollowCardViz implements Visualization {
  id = "follow-card";
  label = "Follow One Card";
  description =
    "Tracks the card that started on top of the deck across every trial. Each cell is that card's color averaged across all trials — solid where the card reliably ends up, fading towards black where it rarely does.";

  private container: HTMLElement | null = null;
  private noteEl: HTMLElement | null = null;
  private scrollEl: HTMLElement | null = null;

  mount(container: HTMLElement, ctx: VizContext): void {
    this.container = container;
    container.innerHTML = `
      <div class="viz-header">
        <h2>${this.label}</h2>
        <p class="viz-desc">${this.description}</p>
      </div>
      <div class="viz-note"></div>
      <div class="follow-card-scroll"></div>
    `;
    this.noteEl = container.querySelector<HTMLElement>(".viz-note");
    this.scrollEl = container.querySelector<HTMLElement>(".follow-card-scroll");
    this.render(ctx);
  }

  render(ctx: VizContext, _options?: VizRenderOptions): void {
    if (!this.scrollEl || !this.noteEl) return;
    const { experiment, colorScheme } = ctx;
    const deckSize = experiment.deckSize;
    const columns = experiment.shuffleCount + 1;
    const numTrials = experiment.trials.length;

    this.noteEl.textContent =
      numTrials < MIN_TRIALS_FOR_SMOOTH_GRADIENT
        ? `Using ${numTrials} trial${numTrials === 1 ? "" : "s"} — raise "Number of decks" for a smoother gradient.`
        : `Averaging ${numTrials} trials.`;

    const counts: number[][] = Array.from({ length: columns }, () => new Array(deckSize).fill(0));
    for (const trial of experiment.trials) {
      for (let k = 0; k < columns; k++) {
        const pos = trial.history[k].indexOf(TRACKED_CARD);
        counts[k][pos]++;
      }
    }

    this.scrollEl.innerHTML = "";
    const { canvas, gfx, cellHeight } = createGridCanvas(columns, deckSize);
    const trackedColor = colorScheme.colorFor(TRACKED_CARD, deckSize);
    const cellGap = cellHeight > 3 ? 1 : 0;

    for (let c = 0; c < columns; c++) {
      for (let r = 0; r < deckSize; r++) {
        const probability = counts[c][r] / numTrials;
        const x = c * CELL_WIDTH;
        const y = HEADER_HEIGHT + r * cellHeight;
        const w = CELL_WIDTH - 1;
        const h = cellHeight - cellGap;

        gfx.fillStyle = BACKGROUND_COLOR;
        gfx.fillRect(x, y, w, h);
        if (probability > 0) {
          gfx.globalAlpha = probability ** VISIBILITY_GAMMA;
          gfx.fillStyle = trackedColor;
          gfx.fillRect(x, y, w, h);
          gfx.globalAlpha = 1;
        }
      }
    }

    this.scrollEl.appendChild(canvas);
  }

  unmount(): void {
    if (this.container) this.container.innerHTML = "";
    this.container = null;
    this.noteEl = null;
    this.scrollEl = null;
  }
}
