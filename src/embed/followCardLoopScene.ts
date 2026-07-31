import { getColorScheme } from "../core/colors";
import { Experiment } from "../core/experiment";
import { createVisualization } from "../viz/registry";
import type { VizContext, Visualization } from "../viz/types";
import { fitToHeight } from "./fitToHeight";
import type { FollowCardLoopConfig } from "./params";

/**
 * Pre-shuffles a fixed number of trials once, then sweeps the tracked card
 * back and forth across the deck forever (0 → deckSize-1 → 0 → ...) — a
 * ping-pong rather than `app.ts`'s modulo wrap, so a looping recording
 * never jump-cuts from the last card back to the first.
 */
export function runFollowCardLoopScene(container: HTMLElement, cfg: FollowCardLoopConfig): void {
  const experiment = new Experiment({ deckSize: cfg.deckSize, numDecks: cfg.numTrials });
  for (let i = 0; i < cfg.shuffleCount; i++) experiment.perform("riffle");

  const colorScheme = getColorScheme(cfg.colorSchemeId);
  let trackedCard = 0;
  const ctx = (): VizContext => ({ experiment, colorScheme, trackedCard });

  const activeViz: Visualization = createVisualization("follow-card");
  activeViz.mount(container, ctx());
  container.classList.toggle("hide-labels", !cfg.showText);
  // Grid dimensions (deckSize, shuffleCount) never change after mount, so
  // height is stable for the whole scene — a one-time fit (plus resize) is
  // enough, no need to refit on every sweep tick.
  fitToHeight(container);

  let direction = 1;
  setInterval(() => {
    trackedCard += direction;
    if (trackedCard >= cfg.deckSize - 1) {
      trackedCard = cfg.deckSize - 1;
      direction = -1;
    } else if (trackedCard <= 0) {
      trackedCard = 0;
      direction = 1;
    }
    activeViz.render(ctx());
  }, cfg.sweepIntervalMs);
}
