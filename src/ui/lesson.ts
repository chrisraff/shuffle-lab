import type { OperationKind } from "../core/operations";
import type { ControlsPanel } from "./controls";

/**
 * What a lesson step is allowed to do to the running app. Kept narrow and
 * declarative on purpose — a step says *what* state it wants, not how to
 * get there, so future steps can be added without knowing app internals.
 */
export interface LessonHost {
  controls: ControlsPanel;
  setDeckSize(size: number): void;
  setNumDecks(numDecks: number): void;
  setColorScheme(id: string): void;
  setViz(id: string): void;
  getVizId(): string;
  runOperation(kind: OperationKind, times?: number): Promise<void>;
  reset(): void;
  getShuffleCount(): number;
  /** Marks Perfect Shuffle as explained, so Sandbox starts showing it too. */
  unlockPerfectShuffle(): void;
}

interface LessonStep {
  title: string;
  body: string;
  /** Draws attention to the Next button itself — for steps with nothing else to interact with. */
  highlightNext?: boolean;
  onEnter?(host: LessonHost): void | Promise<void>;
}

/** Every control a step might want to hide/disable/highlight. */
const ALL_CONTROL_IDS = [
  "deckSize",
  "numDecks",
  "colorScheme",
  "trackedCard",
  "shuffleOnce",
  "shuffleFive",
  "cut",
  "overhand",
  "perfectShuffle",
  "reset",
];

/** Controls this story doesn't need by default — kept hidden unless a step specifically re-shows them. */
const ADVANCED_CONTROL_IDS = ["numDecks", "trackedCard", "cut", "overhand", "shuffleFive", "perfectShuffle"];

const DEMO_SHUFFLE_COUNT = 4;

function resetControlChrome(controls: ControlsPanel): void {
  for (const id of ALL_CONTROL_IDS) {
    const handle = controls.get(id);
    handle.setVisible(true);
    handle.setEnabled(true);
    handle.setHighlighted(false);
  }
}

function hideAdvancedControls(controls: ControlsPanel): void {
  for (const id of ADVANCED_CONTROL_IDS) controls.get(id).setVisible(false);
}

function showControls(controls: ControlsPanel, ids: string[]): void {
  for (const id of ids) controls.get(id).setVisible(true);
}

/** Locks down controls during animated/automated steps — color scheme is exempt so the user can always restyle the view. */
function disableAllControls(controls: ControlsPanel): void {
  for (const id of ALL_CONTROL_IDS) {
    if (id === "colorScheme") continue;
    controls.get(id).setEnabled(false);
  }
}

/** Runs a sequence of operations back-to-back (used to interleave riffles and cuts). */
async function runSequence(host: LessonHost, kinds: OperationKind[]): Promise<void> {
  for (const kind of kinds) await host.runOperation(kind, 1);
}

const STEPS: LessonStep[] = [
  {
    title: "Welcome",
    body: "A riffle shuffle cuts a deck in two and interleaves the halves back together. Every card here is colored by where it started, so watching the colors scatter is watching the deck randomize — in the Column History view below.",
    highlightNext: true,
    onEnter: (host) => {
      host.setViz("column-history");
      host.setColorScheme("sunset");
      host.setNumDecks(1);
      host.setDeckSize(52);
      host.reset();
      resetControlChrome(host.controls);
      hideAdvancedControls(host.controls);
    },
  },
  {
    title: "Zero shuffles",
    body: "Column 0 is the deck before any shuffling — a clean gradient, because every card is still exactly where it started. A standard deck has 52 cards, so that's what we're using.",
    onEnter: (host) => {
      resetControlChrome(host.controls);
      hideAdvancedControls(host.controls);
      host.controls.get("deckSize").setHighlighted(true);
      host.controls.get("deckSize").setEnabled(false);
    },
  },
  {
    title: "Watch it shuffle",
    body: 'Click the highlighted "Shuffle" button a few times. Watch the gradient break apart: each shuffle interleaves two halves of the deck, scattering colors a little further from where they started.',
    onEnter: (host) => {
      resetControlChrome(host.controls);
      hideAdvancedControls(host.controls);
      host.controls.get("deckSize").setEnabled(false);
      host.controls.get("shuffleOnce").setHighlighted(true);
      host.controls.get("reset").setVisible(false);
    },
  },
  {
    title: "Random enough?",
    body: "Four shuffles in, and it looks pretty scrambled, right? But after four, there are still exploitable traces of the original order hiding in here — mathematician Persi Diaconis showed a 52-card deck needs about seven good riffles before it's genuinely close to random. Let's prove it.",
    onEnter: async (host) => {
      resetControlChrome(host.controls);
      hideAdvancedControls(host.controls);
      host.controls.get("deckSize").setEnabled(false);
      disableAllControls(host.controls);
      const remaining = DEMO_SHUFFLE_COUNT - host.getShuffleCount();
      if (remaining > 0) await host.runOperation("riffle", remaining);
      // runOperation re-enables everything when it resolves — lock back down.
      disableAllControls(host.controls);
    },
  },
  {
    title: "The tell",
    body: 'Instead of shuffling one deck, imagine 2000 separate decks, each shuffled four times — same number of shuffles, but no two shuffles ever come out quite the same, just like real life. We track ONE card (drag the slider, or hit ▶ to sweep through all of them) and watch where it lands across those 2000 decks. Brighter means more of the 2000 decks put that card there.\n\nSlide to a card near the top or bottom and its landing spots stay noticeably correlated with where it started — four shuffles usually isn\'t enough to send an edge card to the far side of the deck. Slide to a card near the middle, though, and the picture spreads out much more evenly. If you were hunting for, say, the bottom card from the last hand, you\'d do better checking the bottom half of the deck than anywhere else.',
    onEnter: async (host) => {
      resetControlChrome(host.controls);
      hideAdvancedControls(host.controls);
      host.controls.get("deckSize").setEnabled(false);
      disableAllControls(host.controls);
      host.setNumDecks(2000);
      await host.runOperation("riffle", DEMO_SHUFFLE_COUNT);
      // runOperation re-enables everything when it resolves — lock back down
      // before selectively re-enabling just what this step needs.
      disableAllControls(host.controls);
      showControls(host.controls, ["numDecks", "trackedCard"]);
      host.controls.get("numDecks").setEnabled(true);
      host.controls.get("trackedCard").setEnabled(true);
      host.controls.get("trackedCard").setHighlighted(true);
    },
  },
  {
    title: "The overhand",
    body: "Between hands, a lot of people do a quick overhand shuffle — peeling off packets from the top and restacking them. It feels active, but as we'll see, it barely mixes anything. Give the highlighted Overhand button a few clicks and watch.",
    onEnter: (host) => {
      resetControlChrome(host.controls);
      hideAdvancedControls(host.controls);
      host.controls.get("deckSize").setEnabled(false);
      host.setNumDecks(1);
      host.reset();
      showControls(host.controls, ["overhand"]);
      host.controls.get("overhand").setHighlighted(true);
      host.controls.get("shuffleOnce").setVisible(false);
      host.controls.get("reset").setVisible(false);
    },
  },
  {
    title: "Overhand, exposed",
    body: "Now let's be thorough: 2000 decks, thirty overhand shuffles each. Sweep through the tracked cards again (drag the slider or hit ▶) — there's still a clear, predictable pattern, especially near the top and bottom of the deck. Thirty shuffles in, and it's still not really random.",
    onEnter: async (host) => {
      resetControlChrome(host.controls);
      hideAdvancedControls(host.controls);
      host.controls.get("deckSize").setEnabled(false);
      disableAllControls(host.controls);
      host.setNumDecks(2000);
      await host.runOperation("overhand", 30);
      // runOperation re-enables everything when it resolves — lock back down
      // before selectively re-enabling just what this step needs.
      disableAllControls(host.controls);
      showControls(host.controls, ["numDecks", "trackedCard", "overhand"]);
      host.controls.get("numDecks").setEnabled(true);
      host.controls.get("trackedCard").setEnabled(true);
      host.controls.get("trackedCard").setHighlighted(true);
    },
  },
  {
    title: "The cut",
    body: "One more habit: cutting the deck between shuffles. Cut as many times as you like here — notice the coloring never scrambles, it just rotates. A cut doesn't randomize a deck at all; it only changes which card you start looking from.",
    onEnter: (host) => {
      resetControlChrome(host.controls);
      hideAdvancedControls(host.controls);
      host.controls.get("deckSize").setEnabled(false);
      host.setNumDecks(1);
      host.reset();
      showControls(host.controls, ["cut"]);
      host.controls.get("cut").setHighlighted(true);
      host.controls.get("shuffleOnce").setVisible(false);
      host.controls.get("overhand").setVisible(false);
      host.controls.get("reset").setVisible(false);
    },
  },
  {
    title: "Cuts don't help much",
    body: "Let's repeat those four riffles, but slip in a cut between each one — a common habit at the table. Compare this to what you saw two steps ago: cutting between riffles doesn't add much randomness on top of what the riffles were already doing.",
    onEnter: async (host) => {
      resetControlChrome(host.controls);
      hideAdvancedControls(host.controls);
      host.controls.get("deckSize").setEnabled(false);
      disableAllControls(host.controls);
      host.reset();
      host.setNumDecks(2000);
      await runSequence(host, ["riffle", "cut", "riffle", "cut", "riffle", "cut", "riffle"]);
      // runOperation re-enables everything each time it resolves — lock back
      // down before selectively re-enabling just what this step needs.
      disableAllControls(host.controls);
      showControls(host.controls, ["numDecks", "trackedCard", "cut"]);
      host.controls.get("numDecks").setEnabled(true);
      host.controls.get("trackedCard").setEnabled(true);
      host.controls.get("trackedCard").setHighlighted(true);
    },
  },
  {
    title: "A fair question",
    body: 'You might notice every cut here sends the tracked card to exactly one new spot, never smeared across many — unlike a riffle. That\'s intentional: a cut has no shuffling of its own, nothing card-by-card happens during it. Where every card ends up is decided entirely by where you cut. If each of the 2000 decks were cut at a different random spot, we\'d only be measuring "how many places can you cut a deck" — not "how much does cutting actually mix the cards." So every deck here gets cut at the exact same point, as if you cut all 2000 with one identical motion.',
    onEnter: (host) => {
      resetControlChrome(host.controls);
      hideAdvancedControls(host.controls);
      host.controls.get("deckSize").setEnabled(false);
      showControls(host.controls, ["numDecks", "trackedCard", "cut"]);
    },
  },
  {
    title: "Can you over-shuffle?",
    body: 'Two shuffling myths, sort of true. First: that you can shuffle so much you land back exactly where you started. That\'s real — but only if you perform the exact same perfect interleave every single time, splitting the deck into two exactly even halves that alternate card for card, over and over. No human hand does that by accident, which is exactly why automatic shuffling machines can be a problem: they repeat a much more precise motion, so they need extra randomization built in to avoid it. Try it yourself: hit the highlighted Perfect Shuffle button eight times and watch a 52-card deck return to its original order.\n\nSecond: that you can shuffle "too much." That\'s not really about randomness — real games build their own structure into a deck as it\'s played and discarded, hand after hand. What people are sensing as "too shuffled" is usually just that leftover structure getting erased, which is exactly what shuffling is supposed to do.',
    onEnter: (host) => {
      resetControlChrome(host.controls);
      hideAdvancedControls(host.controls);
      host.controls.get("deckSize").setEnabled(false);
      host.setNumDecks(1);
      host.reset();
      host.unlockPerfectShuffle();
      showControls(host.controls, ["perfectShuffle"]);
      host.controls.get("perfectShuffle").setHighlighted(true);
      host.controls.get("shuffleOnce").setVisible(false);
      host.controls.get("reset").setVisible(false);
    },
  },
  {
    title: "Go shuffle",
    body: "Now you know the real story: an overhand shuffle barely moves anything, a cut just changes where you start, and even four honest riffles still leave traces if you know where to look. Give the deck seven real riffles next game night — nobody will know why the game feels different, but it will.",
    onEnter: (host) => {
      resetControlChrome(host.controls);
    },
  },
];

/** Drives the Explainer mode: linear steps that can hide, disable, or highlight any control. */
export class LessonController {
  private stepIndex = 0;
  private readonly panelEl: HTMLElement;
  private readonly host: LessonHost;
  private readonly onFinish: () => void;

  constructor(panelEl: HTMLElement, host: LessonHost, onFinish: () => void) {
    this.panelEl = panelEl;
    this.host = host;
    this.onFinish = onFinish;
  }

  async start(): Promise<void> {
    this.stepIndex = 0;
    await this.enterStep();
  }

  stop(): void {
    resetControlChrome(this.host.controls);
    // Track Card only applies to Follow One Card — resetControlChrome shows
    // everything unconditionally, so re-sync it against whichever viz is
    // actually active (the user may be bailing out from any step, not just
    // the last one).
    this.host.controls.get("trackedCard").setVisible(this.host.getVizId() === "follow-card");
    this.panelEl.innerHTML = "";
  }

  private async enterStep(): Promise<void> {
    const step = STEPS[this.stepIndex];
    this.renderStep(step);
    // Some steps run long fast-forward sequences (e.g. 30 overhand
    // shuffles) — block navigation until onEnter settles so a mid-flight
    // click can't kick off a second, overlapping step transition.
    this.setNavDisabled(true);
    await step.onEnter?.(this.host);
    this.setNavDisabled(false);
  }

  private setNavDisabled(disabled: boolean): void {
    const isFirst = this.stepIndex === 0;
    const backBtn = this.panelEl.querySelector<HTMLButtonElement>('[data-action="back"]');
    const nextBtn = this.panelEl.querySelector<HTMLButtonElement>('[data-action="next"]');
    if (backBtn) backBtn.disabled = disabled || isFirst;
    if (nextBtn) nextBtn.disabled = disabled;
  }

  private renderStep(step: LessonStep): void {
    const isFirst = this.stepIndex === 0;
    const isLast = this.stepIndex === STEPS.length - 1;
    const paragraphs = step.body
      .split("\n\n")
      .map((p) => `<p class="lesson-body">${p}</p>`)
      .join("");

    this.panelEl.innerHTML = `
      <div class="lesson-progress">Step ${this.stepIndex + 1} of ${STEPS.length}</div>
      <h2 class="lesson-title">${step.title}</h2>
      ${paragraphs}
      <div class="lesson-nav">
        <button type="button" class="btn" data-action="back" ${isFirst ? "disabled" : ""}>Back</button>
        <button type="button" class="btn btn-primary${step.highlightNext ? " is-highlighted" : ""}" data-action="next">${isLast ? "Finish" : "Next"}</button>
      </div>
    `;

    this.panelEl.querySelector<HTMLButtonElement>('[data-action="back"]')?.addEventListener("click", () => {
      void this.goTo(this.stepIndex - 1);
    });
    this.panelEl.querySelector<HTMLButtonElement>('[data-action="next"]')?.addEventListener("click", () => {
      if (isLast) {
        this.onFinish();
      } else {
        void this.goTo(this.stepIndex + 1);
      }
    });
  }

  private async goTo(index: number): Promise<void> {
    this.stepIndex = index;
    await this.enterStep();
  }
}
