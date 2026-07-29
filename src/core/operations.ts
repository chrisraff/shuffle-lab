import type { Rng } from "./rng";
import type { ShuffleStep } from "./shuffle";

export type OperationKind = "riffle" | "cut" | "overhand";

export interface CutStep {
  kind: "cut";
  result: number[];
  /** Where the deck was cut — the top `cutIndex` cards moved to the bottom. */
  cutIndex: number;
}

export interface OverhandStep {
  kind: "overhand";
  result: number[];
  /** Sizes of the packets peeled off the top, in the order they were peeled. */
  packetSizes: number[];
}

export type Step = ShuffleStep | CutStep | OverhandStep;

/**
 * Samples where a cut happens: the top `cutIndex` cards will move to the
 * bottom. Split out from `applyCut` so a caller running many trials in
 * parallel can draw this once and apply the SAME cut to every trial — a
 * cut has no randomness of its own (no per-card choices happen), so its
 * only source of unpredictability is where it was cut. Drawing an
 * independent cut point per trial would measure the variety of possible
 * cut points, not how well a single cut randomizes a deck.
 */
export function sampleCutIndex(deckSize: number, rng: Rng): number {
  return deckSize > 1 ? 1 + Math.floor(rng() * (deckSize - 1)) : 0;
}

/** Applies a cut at `cutIndex`: the top `cutIndex` cards move to the bottom. Barely changes the deck — it's a rotation, not a randomization. */
export function applyCut(deck: readonly number[], cutIndex: number): CutStep {
  const result = [...deck.slice(cutIndex), ...deck.slice(0, cutIndex)];
  return { kind: "cut", result, cutIndex };
}

/** Convenience wrapper: samples a cut point and applies it in one step. */
export function cutDeck(deck: readonly number[], rng: Rng): CutStep {
  return applyCut(deck, sampleCutIndex(deck.length, rng));
}

const DEFAULT_MAX_PACKET_FRACTION = 0.18;

/**
 * The "overhand shuffle": peel small packets off the top of the deck and
 * stack each new packet on top of the last one placed, which reverses the
 * packets' order relative to each other while leaving each packet's
 * internal card order untouched. It's a famously weak (colloquially
 * "lame") shuffle — a handful of large chunks just get reordered, so it
 * barely randomizes anything compared to a riffle.
 */
export function overhandShuffle(
  deck: readonly number[],
  rng: Rng,
  maxPacketFraction: number = DEFAULT_MAX_PACKET_FRACTION,
): OverhandStep {
  const n = deck.length;
  const maxPacket = Math.max(1, Math.round(n * maxPacketFraction));
  const packets: number[][] = [];
  const packetSizes: number[] = [];

  let i = 0;
  while (i < n) {
    const size = Math.min(n - i, 1 + Math.floor(rng() * maxPacket));
    packets.push(deck.slice(i, i + size));
    packetSizes.push(size);
    i += size;
  }

  const result: number[] = [];
  for (let p = packets.length - 1; p >= 0; p--) result.push(...packets[p]);

  return { kind: "overhand", result, packetSizes };
}
