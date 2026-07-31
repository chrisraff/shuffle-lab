import "../style.css";
import "./embed.css";
import { runFollowCardLoopScene } from "./followCardLoopScene";
import { parseFollowCardLoopConfig, parseRiffleLoopConfig } from "./params";
import { runRiffleLoopScene } from "./riffleLoopScene";

// #embed-root always fills the whole iframe (background included);
// #embed-stage is the actual visualization, scaled to fit inside it.
const stage = document.querySelector<HTMLDivElement>("#embed-stage")!;
const search = new URLSearchParams(location.search);

if (search.get("scene") === "follow-card-loop") {
  runFollowCardLoopScene(stage, parseFollowCardLoopConfig(search));
} else {
  runRiffleLoopScene(stage, parseRiffleLoopConfig(search));
}
