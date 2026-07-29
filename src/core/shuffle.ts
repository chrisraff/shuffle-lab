import { sampleBinomial, type Rng } from "./rng";

/** Which half a card was drawn from — used to drive the sandbox animation. */
export type PileSource = "top" | "bottom";

export interface ShuffleStep {
  kind: "riffle";
  /** Deck order (array of original card indices) after this shuffle. */
  result: number[];
  /** How big the top pile was after the cut. */
  cutIndex: number;
  /** For each card in `result`, which pile it was drawn from, in order. */
  sourceSequence: PileSource[];
}

/** Default bias exponent — 1 reproduces the classic GSR riffle-shuffle model. */
export const DEFAULT_BIAS_K = 1;

/**
 * Simulates one riffle shuffle using the Gilbert–Shannon–Reeds model:
 *
 * 1. Cut the deck into a top and bottom pile. The cut point is
 *    Binomial(n, 1/2) rather than an exact half, matching how a human cut
 *    varies card-to-card.
 * 2. Repeatedly drop the next card from the top of one of the two
 *    remaining piles. The probability of drawing from a pile is
 *    proportional to (that pile's remaining size) ^ biasK, so a bigger
 *    remaining pile is more likely to drop next — at equal remaining
 *    sizes it's a coin flip, and as one pile empties the other becomes
 *    increasingly certain to supply the rest of the cards.
 *
 * `biasK` is intentionally tuneable (higher = stronger tilt towards the
 * larger pile) even though the UI doesn't expose it yet.
 */
export function riffleShuffle(
  deck: readonly number[],
  rng: Rng,
  biasK: number = DEFAULT_BIAS_K,
): ShuffleStep {
  const n = deck.length;
  const cutIndex = sampleBinomial(n, 0.5, rng);
  const top = deck.slice(0, cutIndex);
  const bottom = deck.slice(cutIndex);

  const result: number[] = new Array(n);
  const sourceSequence: PileSource[] = new Array(n);

  let i = 0;
  let j = 0;
  for (let slot = 0; slot < n; slot++) {
    const remainingTop = top.length - i;
    const remainingBottom = bottom.length - j;

    let drawFromTop: boolean;
    if (remainingTop === 0) {
      drawFromTop = false;
    } else if (remainingBottom === 0) {
      drawFromTop = true;
    } else {
      const weightTop = remainingTop ** biasK;
      const weightBottom = remainingBottom ** biasK;
      const pTop = weightTop / (weightTop + weightBottom);
      drawFromTop = rng() < pTop;
    }

    if (drawFromTop) {
      result[slot] = top[i++];
      sourceSequence[slot] = "top";
    } else {
      result[slot] = bottom[j++];
      sourceSequence[slot] = "bottom";
    }
  }

  return { kind: "riffle", result, cutIndex, sourceSequence };
}
