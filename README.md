# Shuffle Lab

An interactive visualization of how [riffle shuffling](https://en.wikipedia.org/wiki/Shuffling#Riffle) randomizes a deck of cards, built around the [Gilbert–Shannon–Reeds](https://en.wikipedia.org/wiki/Gilbert%E2%80%93Shannon%E2%80%93Reeds_model) shuffle model and Persi Diaconis's result that a 52-card deck needs about **7 riffle shuffles** before it's close to uniformly random. Also lets you compare that against two much weaker shuffles — a single **cut** and the **overhand shuffle** — to see just how little they randomize by comparison.

## Running it

```sh
npm install
npm run dev      # start the dev server
npm run test     # run the simulation unit tests
npm run build    # type-check and produce a production build
```

## How it works

**Every card keeps a fixed color tied to its ORIGINAL position** (row 0 of the deck is always red, the middle is always green, and so on, depending on the selected color scheme). Shuffling never changes a card's color — only where it sits. That means watching the colors scatter *is* watching the deck randomize, and a deck that still looks like a smooth gradient after a few operations is a deck that's still predictable.

### Sandbox mode

- **Deck size** — how many cards.
- **Number of decks** — a preset picker: **1**, **500**, or **2000** independent decks (trials) run in parallel. There's no reason to hand-pick an arbitrary count in between, and the choice implies which visualization makes sense (see below), so it drives that automatically.
- **Shuffle** / **Shuffle ×5** — advance every deck by one (or five) riffle shuffle(s), simulated with the GSR model: the deck is cut at a `Binomial(n, 1/2)` point, then cards are drawn one at a time from the top of whichever remaining pile is proportionally larger (50/50 when the piles are equal, increasingly certain as one pile empties). This weighting is tuneable via a `biasK` exponent in `core/shuffle.ts`, though it isn't exposed in the UI yet.
- **Cut** — a single cut: the top of the deck (at a random point) moves to the bottom. Barely changes anything — it's a rotation, not a randomization.
- **Overhand** — the classic "lame" overhand shuffle: small packets are peeled off the top and stacked in reverse order. A famously weak shuffle, included so you can see just how little it mixes compared to a riffle.
- Every operation button, and every column in the grid views, is stamped with the same small icon for that operation (an interleave glyph for riffle, scissors for cut, stacked bars for overhand) so it's easy to tell what happened at a glance.
- **Visualization** switches automatically with the deck count, because these two views don't mix well:
  - **Column History** (1 deck): a grid where column *k* is the deck after *k* operations. A shuffle animates — a copy of the last column slides two columns over and splits into its two riffle piles (top pile up, bottom pile down), then cards drop back into the new column (one column over) in the exact order the simulation drew them. This view intentionally only ever shows one deck: averaging many decks' colors together converges to a flat blend almost immediately, well before the underlying permutations are actually close to random, which is misleading rather than informative.
  - **Follow One Card** (500 or 2000 decks): drag the **Track card #** slider (or hit **▶** to auto-cycle through every card) to aggregate every trial into a per-operation-count picture of where that card ends up. Each cell is that card's color, alpha-blended over black by the fraction of trials it landed there (gamma-corrected so faint probabilities stay visible). At 0 shuffles it's a solid spike; watch it spread and fade as the operation count grows.

### Guided Lesson mode

A short, linear walkthrough (`ui/lesson.ts`) that introduces the rainbow deck, lets you shuffle by hand, then fast-forwards to 7 shuffles to make the Diaconis result visible. It's intentionally minimal for now — the point of this first pass was the mechanism: any step can hide, disable, or highlight any control by id (`ControlsPanel#get(id).setVisible/setEnabled/setHighlighted`), so more elaborate lessons (e.g. comparing riffle vs. cut vs. overhand) can be built later without touching the sandbox code.

## Architecture

```
src/
  core/
    rng.ts          seedable PRNG (mulberry32) + binomial sampling
    shuffle.ts       GSR riffle-shuffle simulation
    operations.ts     cut + overhand shuffle simulations, OperationKind/Step union
    deck.ts          identity deck creation
    colors.ts        color schemes (original position -> color)
    experiment.ts     Experiment: N independent trials, retains full operation history
    store.ts          minimal pub/sub Emitter
  viz/
    types.ts          the Visualization interface every viz implements
    registry.ts        VIZ_REGISTRY — add a new visualization here to make it selectable
    grid.ts             shared canvas grid geometry + the per-column operation icon row
    icons.ts             inline SVGs per OperationKind, reused by the grid icons and the operation buttons
    columnHistoryViz.ts
    followCardViz.ts
  ui/
    controls.ts        sandbox control panel, exposes each control by id
    lesson.ts           guided lesson steps + LessonController
    app.ts              wires everything together
```

The `Experiment` is the single source of truth for operation history; visualizations only read from it, so switching between them (or between Sandbox and Guided Lesson) never discards data. Adding a new visualization means implementing `Visualization` in `viz/` and adding one line to `viz/registry.ts`. Adding a new shuffle-like operation means adding a case to `core/operations.ts` (or `core/shuffle.ts`), handling it in `Experiment#performOne`, adding an icon in `viz/icons.ts`, and wiring a button in `ui/controls.ts`.
