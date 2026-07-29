import type { Trial } from "../core/experiment";
import type { ColorScheme } from "../core/colors";
import { CELL_WIDTH, HEADER_HEIGHT, computeCellHeight, createGridCanvas, fillCell } from "./grid";
import type { VizContext, VizRenderOptions, Visualization } from "./types";

const MAX_VISIBLE_TRIALS = 12;

const SPLIT_DURATION_MS = 450;
const DROP_DURATION_MS = 180;
const MAX_DROP_STAGGER_MS = 16;
const TARGET_DROP_PHASE_MS = 1400;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * The primary sandbox visualization: each trial (deck) is drawn as a grid
 * where column 0 is the unshuffled deck, column k is the deck after k
 * shuffles, and each cell's color is the card's ORIGINAL position. Watching
 * the color pattern break up left-to-right is watching the deck randomize.
 *
 * When there's exactly one trial (one deck), a fresh shuffle animates: a
 * copy of the most recent column slides over to the new column slot,
 * splits into its two riffle piles (top pile up, bottom pile down), then
 * the cards drop one at a time into the new column following the exact
 * pile each card was drawn from during simulation.
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

  render(ctx: VizContext, options?: VizRenderOptions): Promise<void> | void {
    if (!this.trialsEl) return;
    const { experiment } = ctx;

    if (options?.animate && experiment.trials.length === 1 && experiment.shuffleCount >= 1) {
      return this.animateLatestShuffle(ctx);
    }

    this.renderStatic(ctx);
  }

  private renderStatic(ctx: VizContext): void {
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
      const { wrap } = buildTrialGrid(trial, trialIndex, experiment.deckSize, colorScheme, showLabels);
      this.trialsEl!.appendChild(wrap);
    });
  }

  private async animateLatestShuffle(ctx: VizContext): Promise<void> {
    if (!this.trialsEl) return;
    const { experiment, colorScheme } = ctx;
    const trial = experiment.trials[0];
    const deckSize = experiment.deckSize;
    const step = trial.steps[trial.steps.length - 1];
    const prevOrder = trial.history[trial.history.length - 2];
    const oldColumnIndex = trial.history.length - 2;
    const newColumnIndex = trial.history.length - 1;
    const cellHeight = computeCellHeight(deckSize);

    this.trialsEl.innerHTML = "";
    const { wrap, stage } = buildTrialGrid(trial, 0, deckSize, colorScheme, false, oldColumnIndex + 1);
    this.trialsEl.appendChild(wrap);

    const overlay = document.createElement("div");
    overlay.className = "anim-overlay";
    stage.appendChild(overlay);

    const cardHeight = Math.max(1, cellHeight - (cellHeight > 3 ? 1 : 0));
    const cards: HTMLDivElement[] = prevOrder.map((cardId, row) => {
      const el = document.createElement("div");
      el.className = "anim-card";
      el.style.width = `${CELL_WIDTH - 1}px`;
      el.style.height = `${cardHeight}px`;
      el.style.background = colorScheme.colorFor(cardId, deckSize);
      setCardPosition(el, oldColumnIndex * CELL_WIDTH, HEADER_HEIGHT + row * cellHeight);
      overlay.appendChild(el);
      return el;
    });

    await nextFrame();

    // Phase 1: slide the copy over to the new column and split it into its
    // two riffle piles — top pile shifts up, bottom pile shifts down.
    const gap = Math.max(6, cellHeight * 1.5);
    cards.forEach((el, row) => {
      const isTopPile = row < step.cutIndex;
      const splitOffset = isTopPile ? -gap : gap;
      el.style.transition = `transform ${SPLIT_DURATION_MS}ms ease`;
      setCardPosition(el, newColumnIndex * CELL_WIDTH, HEADER_HEIGHT + row * cellHeight + splitOffset);
    });
    await wait(SPLIT_DURATION_MS + 30);

    // Phase 2: drop cards one at a time into the new column, in the exact
    // order the shuffle simulation drew them from each pile.
    let topDrawn = 0;
    let bottomDrawn = 0;
    const dropStagger = Math.min(MAX_DROP_STAGGER_MS, Math.max(3, TARGET_DROP_PHASE_MS / deckSize));
    const targetX = newColumnIndex * CELL_WIDTH;

    const drops = step.sourceSequence.map((source, slot) => {
      const cardEl = source === "top" ? cards[topDrawn++] : cards[step.cutIndex + bottomDrawn++];
      const targetY = HEADER_HEIGHT + slot * cellHeight;
      return wait(slot * dropStagger).then(() => {
        cardEl.style.transition = `transform ${DROP_DURATION_MS}ms ease`;
        setCardPosition(cardEl, targetX, targetY);
        return wait(DROP_DURATION_MS);
      });
    });
    await Promise.all(drops);
    await wait(60);

    overlay.remove();
    this.renderStatic(ctx);
  }

  unmount(): void {
    if (this.container) this.container.innerHTML = "";
    this.container = null;
    this.trialsEl = null;
  }
}

function setCardPosition(el: HTMLElement, x: number, y: number): void {
  el.style.transform = `translate(${x}px, ${y}px)`;
}

function buildTrialGrid(
  trial: Trial,
  trialIndex: number,
  deckSize: number,
  colorScheme: ColorScheme,
  showLabel: boolean,
  visibleColumns: number = trial.history.length,
): { wrap: HTMLElement; stage: HTMLElement; canvas: HTMLCanvasElement } {
  const wrap = document.createElement("div");
  wrap.className = "deck-grid-wrap";

  if (showLabel) {
    const label = document.createElement("div");
    label.className = "deck-grid-label";
    label.textContent = `Deck ${trialIndex + 1}`;
    wrap.appendChild(label);
  }

  const stage = document.createElement("div");
  stage.className = "deck-grid-stage";

  const totalColumns = trial.history.length;
  const { canvas, gfx, cellHeight } = createGridCanvas(totalColumns, deckSize);

  for (let c = 0; c < visibleColumns; c++) {
    const order = trial.history[c];
    for (let r = 0; r < deckSize; r++) {
      fillCell(gfx, c, r, cellHeight, colorScheme.colorFor(order[r], deckSize));
    }
  }

  stage.appendChild(canvas);
  wrap.appendChild(stage);
  return { wrap, stage, canvas };
}
