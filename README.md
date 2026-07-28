# Shuffle Lab

An interactive visualization of how [riffle shuffling](https://en.wikipedia.org/wiki/Shuffling#Riffle) randomizes a deck of cards, built around the [Gilbert–Shannon–Reeds](https://en.wikipedia.org/wiki/Gilbert%E2%80%93Shannon%E2%80%93Reeds_model) shuffle model and Persi Diaconis's result that a 52-card deck needs about **7 riffle shuffles** before it's close to uniformly random.

## Running it

```sh
npm install
npm run dev      # start the dev server
npm run test     # run the simulation unit tests
npm run build    # type-check and produce a production build
```

## How it works

**Every card keeps a fixed color tied to its ORIGINAL position** (row 0 of the deck is always red, the middle is always green, and so on, depending on the selected color scheme). Shuffling never changes a card's color — only where it sits. That means watching the colors scatter *is* watching the deck randomize, and a deck that still looks like a smooth gradient after a few shuffles is a deck that's still predictable.

### Sandbox mode

- **Deck size** / **Number of decks** — run any number of independent decks (trials) in parallel, all starting unshuffled.
- **Shuffle** / **Shuffle ×5** — advance every deck by one (or five) riffle shuffle(s), simulated with the GSR model: the deck is cut at a `Binomial(n, 1/2)` point, then cards are drawn one at a time from the top of whichever remaining pile is proportionally larger (50/50 when the piles are equal, increasingly certain as one pile empties). This weighting is tuneable via a `biasK` exponent in `core/shuffle.ts`, though it isn't exposed in the UI yet.
- **Visualization** — switch live between visualizations without losing any shuffle history:
  - **Column History**: each trial is a grid where column *k* is the deck after *k* shuffles. With exactly one deck, a shuffle animates — a copy of the last column slides over, splits into its two riffle piles (top pile up, bottom pile down), then cards drop into the new column in the exact order the simulation drew them.
  - **Follow One Card**: aggregates every trial into a per-shuffle-count histogram of where the card that started on top ends up. At 0 shuffles it's a single spike; watch it widen towards flat as the shuffle count grows — the more decks you run, the smoother the histogram.

### Guided Lesson mode

A short, linear walkthrough (`ui/lesson.ts`) that introduces the rainbow deck, lets you shuffle by hand, then fast-forwards to 7 shuffles to make the Diaconis result visible. It's intentionally minimal for now — the point of this first pass was the mechanism: any step can hide, disable, or highlight any control by id (`ControlsPanel#get(id).setVisible/setEnabled/setHighlighted`), so more elaborate lessons can be built later without touching the sandbox code.

## Architecture

```
src/
  core/
    rng.ts          seedable PRNG (mulberry32) + binomial sampling
    shuffle.ts       GSR riffle-shuffle simulation
    deck.ts          identity deck creation
    colors.ts        color schemes (original position -> color)
    experiment.ts     Experiment: N independent trials, retains full shuffle history
    store.ts          minimal pub/sub Emitter
  viz/
    types.ts          the Visualization interface every viz implements
    registry.ts        VIZ_REGISTRY — add a new visualization here to make it selectable
    columnHistoryViz.ts
    followCardViz.ts
  ui/
    controls.ts        sandbox control panel, exposes each control by id
    lesson.ts           guided lesson steps + LessonController
    app.ts              wires everything together
```

The `Experiment` is the single source of truth for shuffle history; visualizations only read from it, so switching between them (or between Sandbox and Guided Lesson) never discards data. Adding a new visualization means implementing `Visualization` in `viz/` and adding one line to `viz/registry.ts`.
