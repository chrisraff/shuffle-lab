import { getColorScheme } from "../core/colors";
import { Experiment } from "../core/experiment";
import type { OperationKind } from "../core/operations";
import { createVisualization } from "../viz/registry";
import type { VizContext, Visualization } from "../viz/types";
import { ControlsPanel } from "./controls";
import { LessonController, type LessonHost } from "./lesson";

const DEFAULT_DECK_SIZE = 52;
const DEFAULT_NUM_DECKS = 1;
const DEFAULT_COLOR_SCHEME = "sunset";
const DEFAULT_VIZ = "column-history";
const DEFAULT_TRACKED_CARD = 0;
const PLAY_INTERVAL_MS = 100;

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

type Mode = "sandbox" | "lesson";

/** Rendered twice: inline in the (desktop) header, and injected into the settings dialog for mobile — both copies are wired by the same `setMode` loop below, so they can't drift out of sync. */
const MODE_TABS_HTML = `
  <button class="active" data-mode="sandbox">Sandbox</button>
  <button data-mode="lesson">Explainer</button>
`;

const STORAGE_KEY_EXPLAINER_COMPLETED = "shuffle-lab:explainer-completed";
const STORAGE_KEY_LAST_MODE = "shuffle-lab:last-mode";

function readStoredExplainerCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_EXPLAINER_COMPLETED) === "true";
  } catch {
    return false;
  }
}

function readStoredLastMode(): Mode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY_LAST_MODE);
    return value === "sandbox" || value === "lesson" ? value : null;
  } catch {
    return null;
  }
}

function saveExplainerCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY_EXPLAINER_COMPLETED, "true");
  } catch {
    // localStorage may be unavailable (privacy mode, disabled) — the
    // milestone just won't be remembered next visit.
  }
}

function saveLastMode(mode: Mode): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_MODE, mode);
  } catch {
    // Same as above — startup mode just won't be remembered.
  }
}

/** First-time (or not-yet-finished) visitors always land on the Explainer; once they've finished it, we resume whichever mode they left the app in. */
function resolveInitialMode(): Mode {
  if (!readStoredExplainerCompleted()) return "lesson";
  return readStoredLastMode() ?? "lesson";
}

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <header class="app-header">
      <div>
        <h1>Shuffle Lab</h1>
        <div class="subtitle">Visualizing how riffle shuffles randomize a deck</div>
      </div>
      <div class="mode-tabs">${MODE_TABS_HTML}</div>
    </header>
    <div class="panel lesson-panel is-hidden" id="lesson-panel"></div>
    <div class="app-body">
      <aside class="panel" id="controls-panel"></aside>
      <main class="panel" id="viz-panel"></main>
    </div>
  `;

  const lessonPanel = root.querySelector<HTMLElement>("#lesson-panel")!;
  const controlsPanel = root.querySelector<HTMLElement>("#controls-panel")!;
  const vizPanel = root.querySelector<HTMLElement>("#viz-panel")!;

  const experiment = new Experiment({ deckSize: DEFAULT_DECK_SIZE, numDecks: DEFAULT_NUM_DECKS });
  let colorScheme = getColorScheme(DEFAULT_COLOR_SCHEME);
  let trackedCard = DEFAULT_TRACKED_CARD;
  let playTimer: ReturnType<typeof setInterval> | null = null;
  // Perfect Shuffle stays hidden in Sandbox until the Explainer has walked
  // the user through what it means — otherwise it's an unexplained button.
  // Once unlocked, it stays that way across visits (same milestone that
  // unlocks the remembered startup mode below).
  let perfectShuffleUnlocked = readStoredExplainerCompleted();

  function ctx(): VizContext {
    return { experiment, colorScheme, trackedCard };
  }

  let activeViz: Visualization = createVisualization(DEFAULT_VIZ);
  activeViz.mount(vizPanel, ctx());

  function stopPlay(): void {
    if (playTimer === null) return;
    clearInterval(playTimer);
    playTimer = null;
    controls.setTrackedCardPlaying(false);
  }

  function startPlay(): void {
    if (playTimer !== null) return;
    controls.setTrackedCardPlaying(true);
    playTimer = setInterval(() => {
      setTrackedCard((trackedCard + 1) % experiment.deckSize);
    }, PLAY_INTERVAL_MS);
  }

  function setViz(id: string): void {
    if (id !== "follow-card") stopPlay();
    activeViz.unmount();
    activeViz = createVisualization(id);
    activeViz.mount(vizPanel, ctx());
    controls.get("trackedCard").setVisible(id === "follow-card");
  }

  function setDeckSize(size: number): void {
    stopPlay();
    experiment.reset({ deckSize: size });
    controls.get("deckSize").setValue(size);
    controls.setTrackedCardMax(size - 1);
    if (trackedCard > size - 1) {
      trackedCard = size - 1;
      controls.get("trackedCard").setValue(trackedCard);
    }
    activeViz.render(ctx());
  }

  /** A deck-count change always implies which visualization makes sense: one deck for Column History, more for Follow One Card. */
  function setNumDecks(numDecks: number): void {
    experiment.setNumDecks(numDecks);
    controls.get("numDecks").setValue(numDecks);
    const desiredViz = numDecks === 1 ? "column-history" : "follow-card";
    if (activeViz.id !== desiredViz) {
      setViz(desiredViz);
    } else {
      activeViz.render(ctx());
    }
  }

  function setColorScheme(id: string): void {
    colorScheme = getColorScheme(id);
    controls.get("colorScheme").setValue(id);
    activeViz.render(ctx());
  }

  function setTrackedCard(card: number): void {
    trackedCard = card;
    controls.get("trackedCard").setValue(card);
    activeViz.render(ctx());
  }

  function togglePlay(): void {
    if (playTimer !== null) stopPlay();
    else startPlay();
  }

  function doReset(): void {
    experiment.reset();
    activeViz.render(ctx());
  }

  function setControlsEnabled(enabled: boolean): void {
    for (const id of ALL_CONTROL_IDS) controls.get(id).setEnabled(enabled);
  }

  async function performOperation(kind: OperationKind, times: number = 1): Promise<void> {
    // Only animate a single operation on a single deck — bulk runs
    // (Shuffle x5) and multi-deck runs redraw statically.
    const animate = times === 1 && experiment.numDecks === 1;
    setControlsEnabled(false);
    try {
      for (let i = 0; i < times; i++) {
        experiment.perform(kind);
        await activeViz.render(ctx(), { animate });
      }
    } finally {
      setControlsEnabled(true);
    }
  }

  async function performPerfectShuffle(): Promise<void> {
    const animate = experiment.numDecks === 1;
    setControlsEnabled(false);
    try {
      experiment.performPerfectShuffle();
      await activeViz.render(ctx(), { animate });
    } finally {
      setControlsEnabled(true);
    }
  }

  function unlockPerfectShuffle(): void {
    perfectShuffleUnlocked = true;
  }

  function markExplainerCompleted(): void {
    saveExplainerCompleted();
  }

  const controls = new ControlsPanel(
    controlsPanel,
    {
      deckSize: DEFAULT_DECK_SIZE,
      numDecks: DEFAULT_NUM_DECKS,
      colorSchemeId: DEFAULT_COLOR_SCHEME,
      trackedCard: DEFAULT_TRACKED_CARD,
    },
    {
      onDeckSizeChange: setDeckSize,
      onNumDecksChange: setNumDecks,
      onColorSchemeChange: setColorScheme,
      onTrackedCardChange: (card) => {
        // Only reached via genuine user input on the slider — the play
        // timer advances the tracked card by calling setTrackedCard
        // directly, bypassing this callback — so stopping playback here
        // only fires when the user actually grabs the slider themselves.
        stopPlay();
        setTrackedCard(card);
      },
      onTrackedCardPlayToggle: togglePlay,
      onShuffle: (times) => {
        void performOperation("riffle", times);
      },
      onCut: () => {
        void performOperation("cut");
      },
      onOverhand: () => {
        void performOperation("overhand");
      },
      onPerfectShuffle: () => {
        void performPerfectShuffle();
      },
      onReset: doReset,
    },
  );
  controls.get("perfectShuffle").setVisible(perfectShuffleUnlocked);

  controls.getModeTabsSlot().innerHTML = `<div class="mode-tabs">${MODE_TABS_HTML}</div>`;
  const modeButtons = root.querySelectorAll<HTMLButtonElement>(".mode-tabs button");
  for (const btn of modeButtons) {
    btn.addEventListener("click", () => setMode(btn.dataset.mode as Mode));
  }

  const lessonHost: LessonHost = {
    controls,
    setDeckSize,
    setNumDecks,
    setColorScheme,
    setViz,
    getVizId: () => activeViz.id,
    runOperation: performOperation,
    reset: doReset,
    getShuffleCount: () => experiment.shuffleCount,
    unlockPerfectShuffle,
    markExplainerCompleted,
  };

  const lesson = new LessonController(lessonPanel, lessonHost, () => setMode("sandbox"));

  function setMode(mode: Mode): void {
    for (const btn of modeButtons) btn.classList.toggle("active", btn.dataset.mode === mode);
    lessonPanel.classList.toggle("is-hidden", mode !== "lesson");
    // Showing/hiding the lesson panel and viz header/note changes how much
    // vertical room the viz panel has on mobile — the active viz's
    // ResizeObserver (see columnHistoryViz/followCardViz) picks up the
    // resulting resize and refits itself, no explicit re-render needed here.
    vizPanel.classList.toggle("hide-viz-chrome", mode === "lesson");
    if (mode === "lesson") {
      void lesson.start();
    } else {
      lesson.stop();
      // Lesson steps freely show/hide Perfect Shuffle while active — re-sync
      // Sandbox's copy against the unlock flag now that it's in charge again.
      controls.get("perfectShuffle").setVisible(perfectShuffleUnlocked);
    }
    saveLastMode(mode);
  }

  setMode(resolveInitialMode());
}
