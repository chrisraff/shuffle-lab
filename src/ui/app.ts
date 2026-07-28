import { getColorScheme } from "../core/colors";
import { Experiment } from "../core/experiment";
import { createVisualization } from "../viz/registry";
import type { Visualization } from "../viz/types";
import { ControlsPanel } from "./controls";

const DEFAULT_DECK_SIZE = 52;
const DEFAULT_NUM_DECKS = 1;
const DEFAULT_COLOR_SCHEME = "rainbow";
const DEFAULT_VIZ = "column-history";

const ALL_CONTROL_IDS = [
  "deckSize",
  "numDecks",
  "colorScheme",
  "vizSelect",
  "shuffleOnce",
  "shuffleFive",
  "reset",
];

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <header class="app-header">
      <div>
        <h1>Shuffle Lab</h1>
        <div class="subtitle">Visualizing how riffle shuffles randomize a deck</div>
      </div>
      <div class="mode-tabs">
        <button class="active" data-mode="sandbox">Sandbox</button>
        <button data-mode="lesson">Guided Lesson</button>
      </div>
    </header>
    <div class="app-body">
      <aside class="panel" id="controls-panel"></aside>
      <main class="panel" id="viz-panel"></main>
    </div>
  `;

  const controlsPanel = root.querySelector<HTMLElement>("#controls-panel")!;
  const vizPanel = root.querySelector<HTMLElement>("#viz-panel")!;

  const experiment = new Experiment({ deckSize: DEFAULT_DECK_SIZE, numDecks: DEFAULT_NUM_DECKS });
  let colorScheme = getColorScheme(DEFAULT_COLOR_SCHEME);

  let activeViz: Visualization = createVisualization(DEFAULT_VIZ);
  activeViz.mount(vizPanel, { experiment, colorScheme });

  const controls = new ControlsPanel(
    controlsPanel,
    {
      deckSize: DEFAULT_DECK_SIZE,
      numDecks: DEFAULT_NUM_DECKS,
      colorSchemeId: DEFAULT_COLOR_SCHEME,
      vizId: DEFAULT_VIZ,
    },
    {
      onDeckSizeChange: (size) => {
        experiment.reset({ deckSize: size });
        activeViz.render({ experiment, colorScheme });
      },
      onNumDecksChange: (numDecks) => {
        experiment.reset({ numDecks });
        activeViz.render({ experiment, colorScheme });
      },
      onColorSchemeChange: (id) => {
        colorScheme = getColorScheme(id);
        activeViz.render({ experiment, colorScheme });
      },
      onVizChange: (id) => {
        activeViz.unmount();
        activeViz = createVisualization(id);
        activeViz.mount(vizPanel, { experiment, colorScheme });
      },
      onShuffle: (times) => {
        void handleShuffle(times);
      },
      onReset: () => {
        experiment.reset();
        activeViz.render({ experiment, colorScheme });
      },
    },
  );

  function setControlsEnabled(enabled: boolean): void {
    for (const id of ALL_CONTROL_IDS) controls.get(id).setEnabled(enabled);
  }

  async function handleShuffle(times: number): Promise<void> {
    // Only animate a single shuffle triggered on a single deck — bulk
    // shuffles and multi-deck runs redraw statically for speed.
    const animate = times === 1 && experiment.numDecks === 1;
    setControlsEnabled(false);
    try {
      for (let i = 0; i < times; i++) {
        experiment.shuffleOnce();
        await activeViz.render({ experiment, colorScheme }, { animate });
      }
    } finally {
      setControlsEnabled(true);
    }
  }
}
