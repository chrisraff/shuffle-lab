/**
 * Cards are represented purely by their ORIGINAL index (0..deckSize-1).
 * A "deck order" is an array of those indices in current physical order.
 * Color schemes map original index -> color, so a freshly created deck
 * always renders as a clean gradient, and shuffling scrambles that
 * gradient across the columns.
 */
export function createIdentityDeck(deckSize: number): number[] {
  return Array.from({ length: deckSize }, (_, i) => i);
}
