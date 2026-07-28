import type { ColorScheme } from "../core/colors";
import type { Experiment } from "../core/experiment";
import type { ShuffleStep } from "../core/shuffle";

export interface VizContext {
  experiment: Experiment;
  colorScheme: ColorScheme;
}

export interface VizRenderOptions {
  /**
   * True when this render was triggered by a single fresh shuffle (as
   * opposed to a reset, color change, or viz switch). Visualizations that
   * support animated playback (see `columnHistoryViz`'s single-deck mode)
   * use this to decide whether to animate or just redraw statically.
   */
  animate?: boolean;
  /** The step(s) that were just appended, one per trial, when animate is true. */
  newSteps?: ShuffleStep[];
}

/**
 * A pluggable visualization. The app mounts exactly one at a time into the
 * viz panel and keeps it in sync with the shared Experiment; switching
 * between visualizations never touches the Experiment, so history is
 * retained no matter how many times the user switches.
 */
export interface Visualization {
  id: string;
  label: string;
  description: string;
  mount(container: HTMLElement, ctx: VizContext): void;
  render(ctx: VizContext, options?: VizRenderOptions): Promise<void> | void;
  unmount(): void;
}
