import { getColorScheme } from "../core/colors";
import { Experiment } from "../core/experiment";
import { createVisualization } from "../viz/registry";
import type { VizContext, Visualization } from "../viz/types";
import type { RiffleLoopConfig } from "./params";
import { sleep } from "./params";

/**
 * Loops forever: hold on the 0-shuffle gradient, riffle, riffle, hold on
 * the scrambled state, reset, repeat. Single deck only — `ColumnHistoryViz`
 * only makes sense for one trial at a time (see its own doc comment).
 */
export function runRiffleLoopScene(container: HTMLElement, cfg: RiffleLoopConfig): void {
  const experiment = new Experiment({ deckSize: cfg.deckSize, numDecks: 1 });
  const colorScheme = getColorScheme(cfg.colorSchemeId);
  const ctx = (): VizContext => ({ experiment, colorScheme, trackedCard: 0 });

  const activeViz: Visualization = createVisualization("column-history");
  activeViz.mount(container, ctx());
  container.classList.toggle("hide-labels", !cfg.showText);

  void (async () => {
    while (true) {
      // Mount (and every prior lap's reset) already left the 0-shuffle
      // gradient on screen — hold there before riffling again.
      await sleep(cfg.resetHoldMs);

      experiment.perform("riffle");
      await activeViz.render(ctx(), { animate: true });

      experiment.perform("riffle");
      await activeViz.render(ctx(), { animate: true });

      await sleep(cfg.holdMs);

      experiment.reset();
      activeViz.render(ctx());
    }
  })();
}
