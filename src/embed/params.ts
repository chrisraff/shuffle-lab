const DEFAULT_DECK_SIZE = 52;
const DEFAULT_COLOR_SCHEME_ID = "sunset";
const DEFAULT_HOLD_MS = 1000;
const DEFAULT_RESET_HOLD_MS = 1000;
const DEFAULT_NUM_TRIALS = 2000;
const DEFAULT_SHUFFLE_COUNT = 4;
const DEFAULT_SWEEP_INTERVAL_MS = 100;
const DEFAULT_SHOW_TEXT = false;
const DEFAULT_THEME = "auto";

export interface RiffleLoopConfig {
  deckSize: number;
  colorSchemeId: string;
  /** How long to hold on the fully-shuffled state before resetting. */
  holdMs: number;
  /** How long to hold on the freshly-reset 0-shuffle state before riffling again. */
  resetHoldMs: number;
  showText: boolean;
}

export interface FollowCardLoopConfig {
  deckSize: number;
  colorSchemeId: string;
  numTrials: number;
  shuffleCount: number;
  sweepIntervalMs: number;
  showText: boolean;
}

/** Never throws — garbage, missing, or out-of-range input just falls back to `fallback`, same posture as `getColorScheme`/`createVisualization`. */
function parseIntParam(search: URLSearchParams, name: string, fallback: number, min: number, max: number): number {
  const raw = search.get(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** "0"/"false" → false, "1"/"true" → true, anything else (including missing) → `fallback`. */
function parseBoolParam(search: URLSearchParams, name: string, fallback: boolean): boolean {
  const raw = search.get(name);
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  return fallback;
}

export function parseRiffleLoopConfig(search: URLSearchParams): RiffleLoopConfig {
  return {
    deckSize: parseIntParam(search, "deckSize", DEFAULT_DECK_SIZE, 2, 200),
    colorSchemeId: search.get("colorScheme") ?? DEFAULT_COLOR_SCHEME_ID,
    holdMs: parseIntParam(search, "holdMs", DEFAULT_HOLD_MS, 0, 10000),
    resetHoldMs: parseIntParam(search, "resetHoldMs", DEFAULT_RESET_HOLD_MS, 0, 10000),
    showText: parseBoolParam(search, "showText", DEFAULT_SHOW_TEXT),
  };
}

export function parseFollowCardLoopConfig(search: URLSearchParams): FollowCardLoopConfig {
  return {
    deckSize: parseIntParam(search, "deckSize", DEFAULT_DECK_SIZE, 2, 200),
    colorSchemeId: search.get("colorScheme") ?? DEFAULT_COLOR_SCHEME_ID,
    numTrials: parseIntParam(search, "numTrials", DEFAULT_NUM_TRIALS, 1, 5000),
    shuffleCount: parseIntParam(search, "shuffleCount", DEFAULT_SHUFFLE_COUNT, 0, 20),
    sweepIntervalMs: parseIntParam(search, "sweepIntervalMs", DEFAULT_SWEEP_INTERVAL_MS, 16, 2000),
    showText: parseBoolParam(search, "showText", DEFAULT_SHOW_TEXT),
  };
}

/**
 * "light"/"dark" pin the embed to that theme regardless of the visitor's OS
 * setting (letting the embedding page keep it in sync with its own theme
 * state); "auto" (the default, and any other value) follows
 * prefers-color-scheme like the main app does.
 */
export function parseThemeParam(search: URLSearchParams): "light" | "dark" | "auto" {
  const raw = search.get("theme") ?? DEFAULT_THEME;
  return raw === "light" || raw === "dark" ? raw : "auto";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
