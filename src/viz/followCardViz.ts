import { toFullSaturation } from "../core/colors";
import type { OperationKind } from "../core/operations";
import { getEffectiveTheme } from "../core/theme";
import { CELL_WIDTH, HEADER_HEIGHT, buildStepIconRow, createGridCanvas, fitStageToContainer } from "./grid";
import type { VizContext, VizRenderOptions, Visualization } from "./types";

const MIN_TRIALS_FOR_SMOOTH_GRADIENT = 20;
/**
 * Raw probability makes faint cells nearly invisible on a dark background
 * (e.g. 1/52 ≈ 2% opacity) even though the difference from "impossible" is
 * meaningful. Gamma-correcting the opacity (alpha = probability ** GAMMA)
 * keeps 0 -> 0 and 1 -> 1 but boosts everything in between, so low-but-real
 * probabilities stay legible without changing which cells are brighter.
 */
const VISIBILITY_GAMMA = 0.45;

/**
 * Same grid as Column History (row = position, column = shuffle count), but
 * instead of drawing one trial's actual arrangement, each cell shows the
 * TRACKED card's color averaged across every trial: a cell where the card
 * landed in, say, 100% of trials is drawn in full color, one where it
 * landed in 2% of trials is drawn as a faint wash of that color over the
 * background. At 0 shuffles that's a solid color at row 0 and background
 * everywhere else; as shuffles increase the color spreads out and fades,
 * because the tracked card is only ever in one place per trial and "being
 * averaged" with the background everywhere it wasn't.
 */
export class FollowCardViz implements Visualization {
  id = "follow-card";
  label = "Follow One Card";
  description = "Tracks one card across every trial and averages its color — solid where it reliably ends up, fading towards the background where it rarely does.";

  private container: HTMLElement | null = null;
  private descEl: HTMLElement | null = null;
  private noteEl: HTMLElement | null = null;
  private scrollEl: HTMLElement | null = null;
  /** See ColumnHistoryViz's resizeObserver for why this watches the container's box size rather than `window`. */
  private resizeObserver: ResizeObserver | null = null;
  private readonly handleResize = (): void => {
    if (!this.scrollEl) return;
    const stage = this.scrollEl.querySelector<HTMLElement>(".deck-grid-stage");
    if (stage) fitStageToContainer(stage, this.scrollEl);
  };

  mount(container: HTMLElement, ctx: VizContext): void {
    this.container = container;
    container.innerHTML = `
      <div class="viz-header">
        <h2>${this.label}</h2>
        <p class="viz-desc"></p>
      </div>
      <div class="viz-note"></div>
      <div class="follow-card-scroll"></div>
    `;
    this.descEl = container.querySelector<HTMLElement>(".viz-desc");
    this.noteEl = container.querySelector<HTMLElement>(".viz-note");
    this.scrollEl = container.querySelector<HTMLElement>(".follow-card-scroll");
    this.resizeObserver = new ResizeObserver(this.handleResize);
    if (this.scrollEl) this.resizeObserver.observe(this.scrollEl);
    // See ColumnHistoryViz's mount for why this is also needed alongside the ResizeObserver.
    window.visualViewport?.addEventListener("resize", this.handleResize);
    this.render(ctx);
  }

  render(ctx: VizContext, _options?: VizRenderOptions): void {
    if (!this.scrollEl || !this.noteEl || !this.descEl) return;
    const { experiment, colorScheme } = ctx;
    const deckSize = experiment.deckSize;
    const trackedCard = Math.min(Math.max(0, ctx.trackedCard), deckSize - 1);
    const columns = experiment.shuffleCount + 1;
    const numTrials = experiment.trials.length;

    this.descEl.textContent =
      trackedCard === 0
        ? "Tracks the card that started on top of the deck across every trial and averages its color — solid where it reliably ends up, fading towards the background where it rarely does."
        : `Tracks the card that started at position ${trackedCard} across every trial and averages its color — solid where it reliably ends up, fading towards the background where it rarely does.`;

    this.noteEl.textContent =
      numTrials < MIN_TRIALS_FOR_SMOOTH_GRADIENT
        ? `Using ${numTrials} trial${numTrials === 1 ? "" : "s"} — raise "Number of decks" for a smoother gradient.`
        : `Averaging ${numTrials} trials.`;

    const counts: number[][] = Array.from({ length: columns }, () => new Array(deckSize).fill(0));
    for (const trial of experiment.trials) {
      for (let k = 0; k < columns; k++) {
        const pos = trial.history[k].indexOf(trackedCard);
        counts[k][pos]++;
      }
    }

    this.scrollEl.innerHTML = "";
    const stage = document.createElement("div");
    stage.className = "deck-grid-stage";
    const { canvas, gfx, cellHeight } = createGridCanvas(columns, deckSize);
    const trackedColor = toFullSaturation(colorScheme.colorFor(trackedCard, deckSize), getEffectiveTheme());
    const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    const cellGap = cellHeight > 3 ? 1 : 0;

    for (let c = 0; c < columns; c++) {
      for (let r = 0; r < deckSize; r++) {
        const probability = counts[c][r] / numTrials;
        const x = c * CELL_WIDTH;
        const y = HEADER_HEIGHT + r * cellHeight;
        const w = CELL_WIDTH - 1;
        const h = cellHeight - cellGap;

        gfx.fillStyle = backgroundColor;
        gfx.fillRect(x, y, w, h);
        if (probability > 0) {
          gfx.globalAlpha = probability ** VISIBILITY_GAMMA;
          gfx.fillStyle = trackedColor;
          gfx.fillRect(x, y, w, h);
          gfx.globalAlpha = 1;
        }
      }
    }

    stage.appendChild(canvas);
    const firstTrial = experiment.trials[0];
    const getKind = (col: number): OperationKind | null =>
      col === 0 || !firstTrial ? null : (firstTrial.steps[col - 1]?.kind ?? null);
    stage.appendChild(buildStepIconRow(columns, getKind));
    this.scrollEl.appendChild(stage);
    fitStageToContainer(stage, this.scrollEl);
  }

  unmount(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.visualViewport?.removeEventListener("resize", this.handleResize);
    if (this.container) this.container.innerHTML = "";
    this.container = null;
    this.descEl = null;
    this.noteEl = null;
    this.scrollEl = null;
  }
}
