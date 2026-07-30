import { createIdentityDeck } from "./deck";
import { applyCut, overhandShuffle, sampleCutIndex, type OperationKind, type Step } from "./operations";
import { createRng, type Rng } from "./rng";
import { DEFAULT_BIAS_K, riffleShuffle } from "./shuffle";
import { Emitter } from "./store";

/** One independent deck being shuffled. */
export interface Trial {
  /** history[k] = deck order (original indices) after k operations. history[0] is unshuffled. */
  history: number[][];
  /** steps[k] is the operation that produced history[k + 1] from history[k]. */
  steps: Step[];
}

export interface ExperimentConfig {
  deckSize: number;
  numDecks: number;
  biasK: number;
}

const DEFAULT_CONFIG: ExperimentConfig = {
  deckSize: 52,
  numDecks: 1,
  biasK: DEFAULT_BIAS_K,
};

/**
 * Holds the full experiment state: every trial's (i.e. every independent
 * deck's) complete operation history. Visualizations read from this but
 * never mutate it, so switching between visualizations live retains all
 * data.
 */
export class Experiment extends Emitter {
  deckSize: number;
  numDecks: number;
  biasK: number;
  trials: Trial[];
  private rng: Rng;

  constructor(config: Partial<ExperimentConfig> = {}) {
    super();
    const cfg = { ...DEFAULT_CONFIG, ...config };
    this.deckSize = cfg.deckSize;
    this.numDecks = cfg.numDecks;
    this.biasK = cfg.biasK;
    this.rng = createRng(Date.now() ^ 0x9e3779b9);
    this.trials = this.createTrials();
  }

  private createTrials(): Trial[] {
    return Array.from({ length: this.numDecks }, () => ({
      history: [createIdentityDeck(this.deckSize)],
      steps: [],
    }));
  }

  get shuffleCount(): number {
    return this.trials[0]?.steps.length ?? 0;
  }

  /** Re-initializes the experiment, discarding all history. */
  reset(config: Partial<Pick<ExperimentConfig, "deckSize" | "numDecks">> = {}): void {
    if (config.deckSize !== undefined) this.deckSize = config.deckSize;
    if (config.numDecks !== undefined) this.numDecks = config.numDecks;
    this.trials = this.createTrials();
    this.emit();
  }

  /**
   * Changes the trial count without discarding history. Growing replays
   * the existing operation sequence onto each new trial — cuts reuse the
   * exact cut point already shared by the other trials at that step (the
   * same "one shared draw" rule `perform` uses), while riffles and
   * overhand shuffles draw fresh per-trial randomness — so every trial
   * ends up at the same shuffle count. Shrinking just drops trials off
   * the end; nothing is recomputed.
   */
  setNumDecks(numDecks: number): void {
    if (numDecks === this.numDecks) return;
    if (numDecks < this.numDecks) {
      this.trials = this.trials.slice(0, numDecks);
    } else {
      const referenceSteps = this.trials[0]?.steps ?? [];
      const additional = Array.from({ length: numDecks - this.trials.length }, () =>
        this.backfillTrial(referenceSteps),
      );
      this.trials = [...this.trials, ...additional];
    }
    this.numDecks = numDecks;
    this.emit();
  }

  private backfillTrial(referenceSteps: Step[]): Trial {
    const trial: Trial = { history: [createIdentityDeck(this.deckSize)], steps: [] };
    for (const refStep of referenceSteps) {
      const current = trial.history[trial.history.length - 1];
      const cutIndex = refStep.kind === "cut" ? refStep.cutIndex : undefined;
      const step = this.performOne(refStep.kind, current, cutIndex);
      trial.steps.push(step);
      trial.history.push(step.result);
    }
    return trial;
  }

  /** Advances every trial by exactly one operation of the given kind. Returns the new step per trial. */
  perform(kind: OperationKind): Step[] {
    // A cut has no randomness of its own — nothing card-by-card happens
    // during it — so its only source of unpredictability is where it was
    // cut. Sampling that once and sharing it across every trial measures
    // how well A cut randomizes A deck; sampling it per trial would
    // instead just measure the spread of possible cut points, which
    // makes a cut look far more random than it is.
    const sharedCutIndex = kind === "cut" ? sampleCutIndex(this.deckSize, this.rng) : undefined;

    const steps = this.trials.map((trial) => {
      const current = trial.history[trial.history.length - 1];
      const step = this.performOne(kind, current, sharedCutIndex);
      trial.steps.push(step);
      trial.history.push(step.result);
      return step;
    });
    this.emit();
    return steps;
  }

  private performOne(kind: OperationKind, current: number[], sharedCutIndex?: number): Step {
    switch (kind) {
      case "riffle":
        return riffleShuffle(current, this.rng, this.biasK);
      case "cut":
        return applyCut(current, sharedCutIndex!);
      case "overhand":
        return overhandShuffle(current, this.rng);
    }
  }

  /** Position (0 = top of deck) of the given original card index after `shuffleIndex` operations, per trial. */
  positionOf(trialIndex: number, shuffleIndex: number, originalCardIndex: number): number {
    return this.trials[trialIndex].history[shuffleIndex].indexOf(originalCardIndex);
  }
}
