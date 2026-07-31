import "../style.css";
import "./embed.css";
import { runFollowCardLoopScene } from "./followCardLoopScene";
import { parseFollowCardLoopConfig, parseRiffleLoopConfig } from "./params";
import { runRiffleLoopScene } from "./riffleLoopScene";

const root = document.querySelector<HTMLDivElement>("#embed-root")!;
const search = new URLSearchParams(location.search);

if (search.get("scene") === "follow-card-loop") {
  runFollowCardLoopScene(root, parseFollowCardLoopConfig(search));
} else {
  runRiffleLoopScene(root, parseRiffleLoopConfig(search));
}
