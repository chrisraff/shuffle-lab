import { describe, expect, it } from "vitest";
import { Experiment } from "./experiment";

describe("Experiment", () => {
  it("starts with an identity deck per trial and no shuffles", () => {
    const exp = new Experiment({ deckSize: 10, numDecks: 3 });
    expect(exp.trials).toHaveLength(3);
    expect(exp.shuffleCount).toBe(0);
    for (const trial of exp.trials) {
      expect(trial.history).toEqual([[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]]);
    }
  });

  it("retains full history across operations for every trial", () => {
    const exp = new Experiment({ deckSize: 12, numDecks: 4 });
    exp.perform("riffle");
    exp.perform("cut");
    exp.perform("overhand");
    expect(exp.shuffleCount).toBe(3);
    for (const trial of exp.trials) {
      expect(trial.history).toHaveLength(4); // 0-shuffle state + 3 operations
      expect(trial.steps.map((s) => s.kind)).toEqual(["riffle", "cut", "overhand"]);
    }
  });

  it("resets to a fresh identity deck and clears history", () => {
    const exp = new Experiment({ deckSize: 8, numDecks: 1 });
    exp.perform("riffle");
    exp.reset({ deckSize: 5, numDecks: 2 });
    expect(exp.deckSize).toBe(5);
    expect(exp.numDecks).toBe(2);
    expect(exp.shuffleCount).toBe(0);
    expect(exp.trials[0].history).toEqual([[0, 1, 2, 3, 4]]);
  });

  it("notifies subscribers on operations and reset", () => {
    const exp = new Experiment({ deckSize: 6, numDecks: 1 });
    let notifications = 0;
    exp.subscribe(() => notifications++);
    exp.perform("riffle");
    exp.reset();
    expect(notifications).toBe(2);
  });

  it("cuts every trial at the same shared point", () => {
    const exp = new Experiment({ deckSize: 20, numDecks: 50 });
    const steps = exp.perform("cut");
    const cutIndex = steps[0].kind === "cut" ? steps[0].cutIndex : -1;
    expect(cutIndex).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.kind).toBe("cut");
      expect(step.kind === "cut" && step.cutIndex).toBe(cutIndex);
    }
    // Every trial started identical, so a shared cut point means every
    // trial's resulting deck order is identical too.
    const first = exp.trials[0].history[1];
    for (const trial of exp.trials) {
      expect(trial.history[1]).toEqual(first);
    }
  });
});
