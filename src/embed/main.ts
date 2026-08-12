import "../style.css";
import "./embed.css";
import { runFollowCardLoopScene } from "./followCardLoopScene";
import { parseFollowCardLoopConfig, parseRiffleLoopConfig, parseThemeParam } from "./params";
import { runRiffleLoopScene } from "./riffleLoopScene";

// #embed-root always fills the whole iframe (background included);
// #embed-stage is the actual visualization, scaled to fit inside it.
const stage = document.querySelector<HTMLDivElement>("#embed-stage")!;
const search = new URLSearchParams(location.search);

// "auto" leaves data-theme unset, so style.css's prefers-color-scheme rule
// decides — same as the main app. "light"/"dark" pin it, letting the
// embedding page force a theme that matches its own (e.g. a manual toggle
// the OS-level preference alone couldn't reflect).
const theme = parseThemeParam(search);
if (theme !== "auto") document.documentElement.dataset.theme = theme;

if (search.get("scene") === "follow-card-loop") {
  runFollowCardLoopScene(stage, parseFollowCardLoopConfig(search));
} else {
  runRiffleLoopScene(stage, parseRiffleLoopConfig(search));
}
