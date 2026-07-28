import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
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
    <aside class="panel" id="controls-panel">
      <div class="placeholder">Controls coming soon</div>
    </aside>
    <main class="panel" id="viz-panel">
      <div class="placeholder">Visualization coming soon</div>
    </main>
  </div>
`;
