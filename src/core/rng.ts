/** A seedable PRNG so experiments can be reproduced/replayed. */
export type Rng = () => number;

/** mulberry32 — small, fast, decent statistical quality for simulation purposes. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample from Binomial(n, p) by summing n Bernoulli trials.
 * Deck sizes in this app are small (tens to low hundreds), so the naive
 * O(n) loop is fast enough and keeps the code easy to follow.
 */
export function sampleBinomial(n: number, p: number, rng: Rng): number {
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (rng() < p) count++;
  }
  return count;
}
