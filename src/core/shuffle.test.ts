import { describe, expect, it } from "vitest";
import { createIdentityDeck } from "./deck";
import { createRng } from "./rng";
import { riffleShuffle } from "./shuffle";

describe("riffleShuffle", () => {
  it("produces a valid permutation of the deck", () => {
    const rng = createRng(42);
    const deck = createIdentityDeck(52);
    const { result } = riffleShuffle(deck, rng);
    expect(result).toHaveLength(52);
    expect(new Set(result).size).toBe(52);
    expect([...result].sort((a, b) => a - b)).toEqual(deck);
  });

  it("is deterministic for a given rng seed", () => {
    const deck = createIdentityDeck(52);
    const a = riffleShuffle(deck, createRng(7));
    const b = riffleShuffle(deck, createRng(7));
    expect(a.result).toEqual(b.result);
  });

  it("keeps relative order within each pile (rising-sequence property)", () => {
    const rng = createRng(1234);
    const deck = createIdentityDeck(30);
    const { result, cutIndex } = riffleShuffle(deck, rng);
    const top = result.filter((c) => c < cutIndex);
    const bottom = result.filter((c) => c >= cutIndex);
    expect(top).toEqual([...top].sort((a, b) => a - b));
    expect(bottom).toEqual([...bottom].sort((a, b) => a - b));
  });

  it("draws from whichever pile currently has more cards left, more often than not", () => {
    // Replay each shuffle's sourceSequence to reconstruct, at every decision
    // point, which pile had strictly more cards remaining — then check that
    // pile actually supplied the next card more than half the time.
    const n = 40;
    const deck = createIdentityDeck(n);
    let biasedDecisions = 0;
    let wentToLargerPile = 0;

    for (let seed = 0; seed < 300; seed++) {
      const rng = createRng(seed);
      const { cutIndex, sourceSequence } = riffleShuffle(deck, rng);
      let remainingTop = cutIndex;
      let remainingBottom = n - cutIndex;
      for (const source of sourceSequence) {
        if (remainingTop !== remainingBottom) {
          biasedDecisions++;
          const largerPile = remainingTop > remainingBottom ? "top" : "bottom";
          if (source === largerPile) wentToLargerPile++;
        }
        if (source === "top") remainingTop--;
        else remainingBottom--;
      }
    }

    expect(wentToLargerPile / biasedDecisions).toBeGreaterThan(0.5);
  });
});
