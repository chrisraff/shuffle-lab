import type { ColorScheme } from "../core/colors";
import type { Trial } from "../core/experiment";
import type { CutStep, OperationKind, OverhandStep } from "../core/operations";
import type { ShuffleStep } from "../core/shuffle";
import { CELL_WIDTH, HEADER_HEIGHT, buildStepIconRow, computeCellHeight, createGridCanvas, fillCell } from "./grid";
import type { VizContext, VizRenderOptions, Visualization } from "./types";

const SPLIT_DURATION_MS = 450;
const DROP_DURATION_MS = 180;
const MAX_DROP_STAGGER_MS = 16;
const TARGET_DROP_PHASE_MS = 1400;
const CUT_SWAP_DURATION_MS = 500;
const PACKET_MOVE_DURATION_MS = 350;
const MAX_PACKET_STAGGER_MS = 120;
const TARGET_PACKET_STAGGER_PHASE_MS = 1800;

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
 * `ui/app.ts`'s deck-count preset). Every operation animates:
 *
 * - Riffle: a copy of the most recent column slides two columns over
 *   and splits into its two piles (top pile up, bottom pile down) —
 *   giving room to watch them clearly — then cards drop one at a time
 *   back into the new column (one column over) following the exact
 *   pile each was drawn from.
 * - Cut: the copy slides over and splits at the cut point, then the
 *   two packets swap places — the top packet moves below the bottom
 *   one — which is literally what a cut does.
 * - Overhand: packets peel off the top in order and restack in the new
 *   column in REVERSE order, each packet moving as one cohesive block.
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
      return this.animateLatestOperation(ctx);
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

  private animateLatestOperation(ctx: VizContext): Promise<void> {
    const trial = ctx.experiment.trials[0];
    const latestStep = trial.steps[trial.steps.length - 1];
    switch (latestStep.kind) {
      case "riffle":
        return this.animateRiffle(ctx, trial, latestStep);
      case "cut":
        return this.animateCut(ctx, trial, latestStep);
      case "overhand":
        return this.animateOverhand(ctx, trial, latestStep);
    }
  }

  private async animateRiffle(ctx: VizContext, trial: Trial, step: ShuffleStep): Promise<void> {
    if (!this.trialsEl) return;
    const { experiment, colorScheme } = ctx;
    const deckSize = experiment.deckSize;
    const { overlay, cards, newColumnIndex, cellHeight } = buildAnimationStage(
      this.trialsEl,
      trial,
      deckSize,
      colorScheme,
      1, // reserve an extra column to overshoot into before landing
    );
    const overshootColumnIndex = newColumnIndex + 1;

    await nextFrame();

    // Phase 1: slide the copy TWO columns over (to the overshoot column)
    // and split it into its two riffle piles — top pile up, bottom pile
    // down — leaving room to clearly watch them interleave on the way in.
    const gap = Math.max(6, cellHeight * 1.5);
    cards.forEach((el, row) => {
      const isTopPile = row < step.cutIndex;
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

  private async animateCut(ctx: VizContext, trial: Trial, step: CutStep): Promise<void> {
    if (!this.trialsEl) return;
    const { experiment, colorScheme } = ctx;
    const deckSize = experiment.deckSize;
    const { overlay, cards, newColumnIndex, cellHeight } = buildAnimationStage(
      this.trialsEl,
      trial,
      deckSize,
      colorScheme,
      0,
    );
    const targetX = newColumnIndex * CELL_WIDTH;

    await nextFrame();

    // Phase 1: slide the copy into the new column and split it at the cut
    // point, opening a gap between the two packets.
    const gap = Math.max(6, cellHeight * 1.5);
    cards.forEach((el, row) => {
      const isTop = row < step.cutIndex;
      const offset = isTop ? -gap : gap;
      el.style.transition = `transform ${SPLIT_DURATION_MS}ms ease`;
      setCardPosition(el, targetX, HEADER_HEIGHT + row * cellHeight + offset);
    });
    await wait(SPLIT_DURATION_MS + 30);

    // Phase 2: the two packets swap places — the top packet moves below
    // the bottom packet — which is exactly what a cut does.
    cards.forEach((el, row) => {
      const newRow = row < step.cutIndex ? row + (deckSize - step.cutIndex) : row - step.cutIndex;
      el.style.transition = `transform ${CUT_SWAP_DURATION_MS}ms ease`;
      setCardPosition(el, targetX, HEADER_HEIGHT + newRow * cellHeight);
    });
    await wait(CUT_SWAP_DURATION_MS + 60);

    overlay.remove();
    this.renderStatic(ctx);
  }

  private async animateOverhand(ctx: VizContext, trial: Trial, step: OverhandStep): Promise<void> {
    if (!this.trialsEl) return;
    const { experiment, colorScheme } = ctx;
    const deckSize = experiment.deckSize;
    const { overlay, cards, newColumnIndex, cellHeight } = buildAnimationStage(
      this.trialsEl,
      trial,
      deckSize,
      colorScheme,
      0,
    );
    const targetX = newColumnIndex * CELL_WIDTH;

    await nextFrame();

    // Packets peel off the top in order and restack in the new column in
    // REVERSE order, each packet moving together as one block — the last
    // packet peeled (originally the bottom of the deck) ends up on top.
    const packetStagger = Math.min(
      MAX_PACKET_STAGGER_MS,
      Math.max(30, TARGET_PACKET_STAGGER_PHASE_MS / step.packetSizes.length),
    );

    let oldRowStart = 0;
    let remaining = deckSize;
    const moves = step.packetSizes.map((size, packetIndex) => {
      const packetRows = Array.from({ length: size }, (_, i) => oldRowStart + i);
      oldRowStart += size;
      remaining -= size;
      const newRowStart = remaining;
      const delay = packetIndex * packetStagger;

      return wait(delay).then(() => {
        packetRows.forEach((oldRow, i) => {
          const el = cards[oldRow];
          el.style.transition = `transform ${PACKET_MOVE_DURATION_MS}ms ease`;
          setCardPosition(el, targetX, HEADER_HEIGHT + (newRowStart + i) * cellHeight);
        });
        return wait(PACKET_MOVE_DURATION_MS);
      });
    });
    await Promise.all(moves);
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

/**
 * Common setup for every operation's animation: draws the completed
 * columns statically, reserves `extraColumns` of blank width beyond the
 * final column count (riffle uses this to overshoot before landing), and
 * creates one draggable overlay card per row, positioned over the most
 * recent column, ready to be animated into their new positions.
 */
function buildAnimationStage(
  trialsEl: HTMLElement,
  trial: Trial,
  deckSize: number,
  colorScheme: ColorScheme,
  extraColumns: number,
): {
  oldColumnIndex: number;
  newColumnIndex: number;
  cellHeight: number;
  overlay: HTMLElement;
  cards: HTMLDivElement[];
} {
  const prevOrder = trial.history[trial.history.length - 2];
  const oldColumnIndex = trial.history.length - 2;
  const newColumnIndex = trial.history.length - 1;
  const cellHeight = computeCellHeight(deckSize);

  trialsEl.innerHTML = "";
  const { wrap, stage } = buildTrialGrid(
    trial,
    deckSize,
    colorScheme,
    oldColumnIndex + 1, // visibleColumns: only draw completed columns
    trial.history.length + extraColumns, // widthColumns
  );
  trialsEl.appendChild(wrap);

  const overlay = document.createElement("div");
  overlay.className = "anim-overlay";
  stage.appendChild(overlay);

  const cardHeight = Math.max(1, cellHeight - (cellHeight > 3 ? 1 : 0));
  const cards = prevOrder.map((cardId, row) => {
    const el = document.createElement("div");
    el.className = "anim-card";
    el.style.width = `${CELL_WIDTH - 1}px`;
    el.style.height = `${cardHeight}px`;
    el.style.background = colorScheme.colorFor(cardId, deckSize);
    setCardPosition(el, oldColumnIndex * CELL_WIDTH, HEADER_HEIGHT + row * cellHeight);
    overlay.appendChild(el);
    return el;
  });

  return { oldColumnIndex, newColumnIndex, cellHeight, overlay, cards };
}
