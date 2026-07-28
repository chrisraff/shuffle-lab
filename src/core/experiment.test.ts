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

  it("retains full history across shuffles for every trial", () => {
    const exp = new Experiment({ deckSize: 12, numDecks: 4 });
    exp.shuffleOnce();
    exp.shuffleOnce();
    exp.shuffleOnce();
    expect(exp.shuffleCount).toBe(3);
    for (const trial of exp.trials) {
      expect(trial.history).toHaveLength(4); // 0-shuffle state + 3 shuffles
      expect(trial.steps).toHaveLength(3);
    }
  });

  it("resets to a fresh identity deck and clears history", () => {
    const exp = new Experiment({ deckSize: 8, numDecks: 1 });
    exp.shuffleOnce();
    exp.reset({ deckSize: 5, numDecks: 2 });
    expect(exp.deckSize).toBe(5);
    expect(exp.numDecks).toBe(2);
    expect(exp.shuffleCount).toBe(0);
    expect(exp.trials[0].history).toEqual([[0, 1, 2, 3, 4]]);
  });

  it("notifies subscribers on shuffle and reset", () => {
    const exp = new Experiment({ deckSize: 6, numDecks: 1 });
    let notifications = 0;
    exp.subscribe(() => notifications++);
    exp.shuffleOnce();
    exp.reset();
    expect(notifications).toBe(2);
  });
});
