import { ColumnHistoryViz } from "./columnHistoryViz";
import { FollowCardViz } from "./followCardViz";
import type { Visualization } from "./types";

export interface VizDescriptor {
  id: string;
  label: string;
  create(): Visualization;
}

/**
 * Every visualization the app can switch to lives here. Adding a new one
 * (e.g. a future "shuffle quality" or "rising sequences" view) only
 * requires implementing `Visualization` and appending an entry below —
 * the controls panel and app wiring pick it up automatically.
 */
export const VIZ_REGISTRY: VizDescriptor[] = [
  { id: "column-history", label: "Column History", create: () => new ColumnHistoryViz() },
  { id: "follow-card", label: "Follow One Card", create: () => new FollowCardViz() },
];

export function createVisualization(id: string): Visualization {
  const descriptor = VIZ_REGISTRY.find((v) => v.id === id) ?? VIZ_REGISTRY[0];
  return descriptor.create();
}
