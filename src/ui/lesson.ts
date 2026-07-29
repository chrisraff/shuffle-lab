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
  shuffle(times: number): Promise<void>;
  reset(): void;
  getShuffleCount(): number;
}

interface LessonStep {
  title: string;
  body: string;
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
  "reset",
];

/** Controls this simple lesson doesn't need — kept hidden throughout so the UI stays focused on the riffle shuffle story. */
const ADVANCED_CONTROL_IDS = ["numDecks", "trackedCard", "cut", "overhand"];

const FULLY_RANDOM_SHUFFLE_COUNT = 7;

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

const STEPS: LessonStep[] = [
  {
    title: "Welcome",
    body: "A riffle shuffle cuts a deck in two and interleaves the halves back together. This tool colors every card by its ORIGINAL position, so you can literally watch a deck randomize, one shuffle at a time, in the Column History view to the right.",
    onEnter: (host) => {
      host.setViz("column-history");
      host.setColorScheme("rainbow");
      host.setNumDecks(1);
      host.setDeckSize(52);
      host.reset();
      resetControlChrome(host.controls);
      hideAdvancedControls(host.controls);
    },
  },
  {
    title: "The rainbow deck",
    body: "Column 0 is the deck before any shuffling — a clean gradient, because every card is still exactly where it started. A standard deck has 52 cards, so that's our deck size for this lesson.",
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
      host.controls.get("shuffleFive").setVisible(false);
      host.controls.get("reset").setVisible(false);
    },
  },
  {
    title: "Why 7 shuffles?",
    body: "Mathematician Persi Diaconis showed that a 52-card deck needs about 7 riffle shuffles before it's close to truly random. Fewer than that, and the deck still carries detectable structure — long unbroken runs from the original order — that a sharp observer could exploit. We'll fast-forward to 7 shuffles now.",
    onEnter: async (host) => {
      resetControlChrome(host.controls);
      hideAdvancedControls(host.controls);
      for (const id of ALL_CONTROL_IDS) host.controls.get(id).setEnabled(false);
      const remaining = FULLY_RANDOM_SHUFFLE_COUNT - host.getShuffleCount();
      if (remaining > 0) await host.shuffle(remaining);
    },
  },
  {
    title: "Back to the sandbox",
    body: 'That\'s the core idea. Head back to Sandbox mode to explore further: run many decks at once and switch to "Follow One Card" to see how a single card\'s position spreads out over many trials, or try different deck sizes and color schemes.',
    onEnter: (host) => {
      resetControlChrome(host.controls);
    },
  },
];

/** Drives the (intentionally simple) guided lesson: linear steps that can hide, disable, or highlight any control. */
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
    this.panelEl.innerHTML = "";
  }

  private async enterStep(): Promise<void> {
    const step = STEPS[this.stepIndex];
    this.renderStep(step);
    await step.onEnter?.(this.host);
  }

  private renderStep(step: LessonStep): void {
    const isFirst = this.stepIndex === 0;
    const isLast = this.stepIndex === STEPS.length - 1;

    this.panelEl.innerHTML = `
      <div class="lesson-progress">Step ${this.stepIndex + 1} of ${STEPS.length}</div>
      <h2 class="lesson-title">${step.title}</h2>
      <p class="lesson-body">${step.body}</p>
      <div class="lesson-nav">
        <button type="button" class="btn" data-action="back" ${isFirst ? "disabled" : ""}>Back</button>
        <button type="button" class="btn btn-primary" data-action="next">${isLast ? "Finish" : "Next"}</button>
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
