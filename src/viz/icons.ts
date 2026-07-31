import type { OperationKind } from "../core/operations";

const RIFFLE_SVG = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 2L15 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M1 6L15 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M1 14L15 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/><path d="M1 10L15 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/></svg>`;

const CUT_SVG = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="4" r="1.6" stroke="currentColor" stroke-width="1.3"/><circle cx="4" cy="12" r="1.6" stroke="currentColor" stroke-width="1.3"/><path d="M5.2 5.2L13 13M5.2 10.8L13 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;

const OVERHAND_SVG = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="3" width="7" height="2.2" rx="0.5" fill="currentColor"/><rect x="1.5" y="6.9" width="7" height="2.2" rx="0.5" fill="currentColor" opacity="0.65"/><rect x="1.5" y="10.8" width="7" height="2.2" rx="0.5" fill="currentColor" opacity="0.35"/><path d="M12.5 2.5V13.5M12.5 2.5L10.7 4.5M12.5 2.5L14.3 4.5M12.5 13.5L10.7 11.5M12.5 13.5L14.3 11.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** One small inline SVG per operation kind, drawn over each grid column to show what produced it. */
export const OPERATION_ICON_SVG: Record<OperationKind, string> = {
  riffle: RIFFLE_SVG,
  cut: CUT_SVG,
  overhand: OVERHAND_SVG,
};

export const OPERATION_LABEL: Record<OperationKind, string> = {
  riffle: "Riffle shuffle",
  cut: "Cut",
  overhand: "Overhand shuffle",
};
