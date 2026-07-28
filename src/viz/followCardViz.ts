import type { ColorScheme } from "../core/colors";
import type { VizContext, VizRenderOptions, Visualization } from "./types";

const PANEL_WIDTH = 150;
const PANEL_HEIGHT = 130;
const HEADER_HEIGHT = 18;
const AXIS_HEIGHT = 14;
const MIN_TRIALS_FOR_SMOOTH_HISTOGRAM = 20;

/** The card whose position we track — the one that started on top of the deck. */
const TRACKED_CARD = 0;

/**
 * Aggregates every trial (independent deck) into, for each shuffle count k,
 * a histogram of where the tracked card ended up. At k = 0 it's a single
 * spike at position 0; as k grows the histogram widens until it's roughly
 * flat, which is the visual signature of the deck becoming random.
 */
export class FollowCardViz implements Visualization {
  id = "follow-card";
  label = "Follow One Card";
  description =
    "Tracks the card that started on top of the deck across every trial, showing how its position spreads out as the number of shuffles grows.";

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
    const panelCount = experiment.shuffleCount + 1;
    const numTrials = experiment.trials.length;

    this.noteEl.textContent =
      numTrials < MIN_TRIALS_FOR_SMOOTH_HISTOGRAM
        ? `Using ${numTrials} trial${numTrials === 1 ? "" : "s"} — raise "Number of decks" for a smoother distribution.`
        : `Aggregating ${numTrials} trials.`;

    const counts: number[][] = Array.from({ length: panelCount }, () => new Array(deckSize).fill(0));
    for (const trial of experiment.trials) {
      for (let k = 0; k < panelCount; k++) {
        const pos = trial.history[k].indexOf(TRACKED_CARD);
        counts[k][pos]++;
      }
    }

    this.scrollEl.innerHTML = "";
    const canvas = document.createElement("canvas");
    const widthCss = panelCount * PANEL_WIDTH;
    const heightCss = HEADER_HEIGHT + PANEL_HEIGHT + AXIS_HEIGHT;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${widthCss}px`;
    canvas.style.height = `${heightCss}px`;
    canvas.width = widthCss * dpr;
    canvas.height = heightCss * dpr;

    const gfx = canvas.getContext("2d")!;
    gfx.scale(dpr, dpr);
    gfx.fillStyle = "#0f1115";
    gfx.fillRect(0, 0, widthCss, heightCss);

    for (let k = 0; k < panelCount; k++) {
      drawPanel(gfx, k, counts[k], deckSize, colorScheme, numTrials);
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

function drawPanel(
  gfx: CanvasRenderingContext2D,
  panelIndex: number,
  counts: number[],
  deckSize: number,
  colorScheme: ColorScheme,
  numTrials: number,
): void {
  const x0 = panelIndex * PANEL_WIDTH;
  const plotTop = HEADER_HEIGHT;
  const plotHeight = PANEL_HEIGHT;
  const maxCount = Math.max(1, ...counts);

  gfx.fillStyle = "#9aa1ac";
  gfx.font = "10px system-ui, sans-serif";
  gfx.textAlign = "center";
  gfx.fillText(`${panelIndex} shuffle${panelIndex === 1 ? "" : "s"}`, x0 + PANEL_WIDTH / 2, 12);

  const barGap = deckSize > 60 ? 0 : 1;
  const barWidth = Math.max(1, PANEL_WIDTH / deckSize - barGap);

  for (let pos = 0; pos < deckSize; pos++) {
    const count = counts[pos];
    if (count === 0) continue;
    const barHeight = (count / maxCount) * (plotHeight - 4);
    const barX = x0 + (pos / deckSize) * PANEL_WIDTH;
    const barY = plotTop + plotHeight - barHeight;
    gfx.fillStyle = colorScheme.colorFor(pos, deckSize);
    gfx.fillRect(barX, barY, barWidth, barHeight);
  }

  gfx.strokeStyle = "#2a2f3a";
  gfx.beginPath();
  gfx.moveTo(x0, plotTop + plotHeight + 0.5);
  gfx.lineTo(x0 + PANEL_WIDTH, plotTop + plotHeight + 0.5);
  gfx.stroke();

  gfx.fillStyle = "#6b7280";
  gfx.font = "9px system-ui, sans-serif";
  gfx.fillText(`peak ${Math.round((maxCount / numTrials) * 100)}%`, x0 + PANEL_WIDTH / 2, plotTop + plotHeight + AXIS_HEIGHT - 2);
}
