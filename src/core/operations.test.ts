import { describe, expect, it } from "vitest";
import { createIdentityDeck } from "./deck";
import { createRng } from "./rng";
import { cutDeck, overhandShuffle } from "./operations";

describe("cutDeck", () => {
  it("produces a valid permutation", () => {
    const rng = createRng(3);
    const deck = createIdentityDeck(30);
    const { result } = cutDeck(deck, rng);
    expect(result).toHaveLength(30);
    expect(new Set(result).size).toBe(30);
  });

  it("rotates the deck at the cut point", () => {
    const deck = createIdentityDeck(10);
    // rng() always 0 -> cutIndex = 1 -> top card moves to the bottom.
    const { result, cutIndex } = cutDeck(deck, () => 0);
    expect(cutIndex).toBe(1);
    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
  });
});

describe("overhandShuffle", () => {
  it("produces a valid permutation", () => {
    const rng = createRng(9);
    const deck = createIdentityDeck(40);
    const { result } = overhandShuffle(deck, rng);
    expect(result).toHaveLength(40);
    expect(new Set(result).size).toBe(40);
  });

  it("reverses the deck when every packet has size 1", () => {
    const deck = createIdentityDeck(8);
    // rng() always 0 -> every packet size is 1 -> full reversal.
    const { result, packetSizes } = overhandShuffle(deck, () => 0);
    expect(packetSizes).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(result).toEqual([...deck].reverse());
  });
});
