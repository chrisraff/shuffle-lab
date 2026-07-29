import type { ColorScheme } from "../core/colors";
import type { Trial } from "../core/experiment";
import type { OperationKind } from "../core/operations";
import { CELL_WIDTH, HEADER_HEIGHT, buildStepIconRow, computeCellHeight, createGridCanvas, fillCell } from "./grid";
import type { VizContext, VizRenderOptions, Visualization } from "./types";

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
 * The single-deck sandbox visualization: a grid where column 0 is the
 * unshuffled deck, column k is the deck after k operations, and each
 * cell's color is a card's ORIGINAL position. Watching the color pattern
 * break up left-to-right is watching the deck randomize. A small icon
 * above each column shows which operation (riffle, cut, overhand)
 * produced it.
 *
 * Only makes sense for one deck at a time — averaging many decks'
 * colors together converges to a flat blend well before the underlying
 * permutations are actually random, which is misleading, so the app
 * only mounts this view when there's exactly one trial (see
 * `ui/app.ts`'s deck-count preset). A fresh riffle shuffle animates: a
 * copy of the most recent column slides two columns over and splits
 * into its two riffle piles (top pile up, bottom pile down) — giving
 * room to watch them clearly — then the cards drop one at a time back
 * into the new column (one column over) following the exact pile each
 * was drawn from.
 */
export class ColumnHistoryViz implements Visualization {
  id = "column-history";
  label = "Column History";
  description = "Each column is the deck after N operations. Row = position in the deck, color = the card's original position.";

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
    const { wrap } = buildTrialGrid(experiment.trials[0], experiment.deckSize, colorScheme);
    this.trialsEl.appendChild(wrap);
  }

  private async animateLatestShuffle(ctx: VizContext): Promise<void> {
    if (!this.trialsEl) return;
    const { experiment, colorScheme } = ctx;
    const trial = experiment.trials[0];
    const latestStep = trial.steps[trial.steps.length - 1];
    if (latestStep.kind !== "riffle") {
      this.renderStatic(ctx);
      return;
    }

    const deckSize = experiment.deckSize;
    const prevOrder = trial.history[trial.history.length - 2];
    const oldColumnIndex = trial.history.length - 2;
    const newColumnIndex = trial.history.length - 1;
    const overshootColumnIndex = newColumnIndex + 1;
    const cellHeight = computeCellHeight(deckSize);

    this.trialsEl.innerHTML = "";
    const { wrap, stage } = buildTrialGrid(
      trial,
      deckSize,
      colorScheme,
      oldColumnIndex + 1, // visibleColumns: only draw completed columns
      overshootColumnIndex + 1, // widthColumns: reserve room for the overshoot column
    );
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

    // Phase 1: slide the copy TWO columns over (to the overshoot column)
    // and split it into its two riffle piles — top pile up, bottom pile
    // down — leaving room to clearly watch them interleave on the way in.
    const gap = Math.max(6, cellHeight * 1.5);
    cards.forEach((el, row) => {
      const isTopPile = row < latestStep.cutIndex;
      const splitOffset = isTopPile ? -gap : gap;
      el.style.transition = `transform ${SPLIT_DURATION_MS}ms ease`;
      setCardPosition(el, overshootColumnIndex * CELL_WIDTH, HEADER_HEIGHT + row * cellHeight + splitOffset);
    });
    await wait(SPLIT_DURATION_MS + 30);

    // Phase 2: drop cards one at a time back into the new column — one
    // column short of the overshoot — in the exact order simulated.
    let topDrawn = 0;
    let bottomDrawn = 0;
    const dropStagger = Math.min(MAX_DROP_STAGGER_MS, Math.max(3, TARGET_DROP_PHASE_MS / deckSize));
    const targetX = newColumnIndex * CELL_WIDTH;

    const drops = latestStep.sourceSequence.map((source, slot) => {
      const cardEl = source === "top" ? cards[topDrawn++] : cards[latestStep.cutIndex + bottomDrawn++];
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

function stepKindAt(trial: Trial, column: number): OperationKind | null {
  if (column === 0) return null;
  return trial.steps[column - 1]?.kind ?? null;
}

function buildTrialGrid(
  trial: Trial,
  deckSize: number,
  colorScheme: ColorScheme,
  visibleColumns: number = trial.history.length,
  widthColumns: number = trial.history.length,
): { wrap: HTMLElement; stage: HTMLElement; canvas: HTMLCanvasElement } {
  const wrap = document.createElement("div");
  wrap.className = "deck-grid-wrap";

  const stage = document.createElement("div");
  stage.className = "deck-grid-stage";

  const { canvas, gfx, cellHeight } = createGridCanvas(widthColumns, deckSize, trial.history.length);

  for (let c = 0; c < visibleColumns; c++) {
    const order = trial.history[c];
    for (let r = 0; r < deckSize; r++) {
      fillCell(gfx, c, r, cellHeight, colorScheme.colorFor(order[r], deckSize));
    }
  }

  stage.appendChild(canvas);
  stage.appendChild(buildStepIconRow(visibleColumns, (col) => stepKindAt(trial, col)));
  wrap.appendChild(stage);
  return { wrap, stage, canvas };
}
