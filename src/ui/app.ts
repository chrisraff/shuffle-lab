import { getColorScheme } from "../core/colors";
import { Experiment } from "../core/experiment";
import { ColumnHistoryViz } from "../viz/columnHistoryViz";
import type { Visualization } from "../viz/types";
import { ControlsPanel } from "./controls";

const DEFAULT_DECK_SIZE = 52;
const DEFAULT_NUM_DECKS = 1;
const DEFAULT_COLOR_SCHEME = "rainbow";

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

  const activeViz: Visualization = new ColumnHistoryViz();
  activeViz.mount(vizPanel, { experiment, colorScheme });

  experiment.subscribe(() => activeViz.render({ experiment, colorScheme }));

  new ControlsPanel(
    controlsPanel,
    { deckSize: DEFAULT_DECK_SIZE, numDecks: DEFAULT_NUM_DECKS, colorSchemeId: DEFAULT_COLOR_SCHEME },
    {
      onDeckSizeChange: (size) => experiment.reset({ deckSize: size }),
      onNumDecksChange: (numDecks) => experiment.reset({ numDecks }),
      onColorSchemeChange: (id) => {
        colorScheme = getColorScheme(id);
        activeViz.render({ experiment, colorScheme });
      },
      onShuffle: (times) => {
        for (let i = 0; i < times; i++) experiment.shuffleOnce();
      },
      onReset: () => experiment.reset(),
    },
  );
}
