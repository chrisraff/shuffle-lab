import { COLOR_SCHEMES } from "../core/colors";
import { OPERATION_ICON_SVG } from "../viz/icons";

const PLAY_ICON_SVG = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4 2.5v11l10-5.5-10-5.5z"/></svg>`;
const PAUSE_ICON_SVG = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="2.5" width="3.4" height="11" rx="0.6"/><rect x="9.1" y="2.5" width="3.4" height="11" rx="0.6"/></svg>`;
const HAMBURGER_ICON_SVG = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="3.2" width="12" height="1.6" rx="0.8"/><rect x="2" y="7.2" width="12" height="1.6" rx="0.8"/><rect x="2" y="11.2" width="12" height="1.6" rx="0.8"/></svg>`;

export interface ControlsCallbacks {
  onDeckSizeChange(size: number): void;
  onNumDecksChange(numDecks: number): void;
  onColorSchemeChange(colorSchemeId: string): void;
  onTrackedCardChange(card: number): void;
  onTrackedCardPlayToggle(): void;
  onShuffle(times: number): void;
  onCut(): void;
  onOverhand(): void;
  onPerfectShuffle(): void;
  onReset(): void;
}

export interface ControlsInitial {
  deckSize: number;
  numDecks: number;
  colorSchemeId: string;
  trackedCard: number;
}

/** A handle onto one control's DOM, letting a lesson script hide/disable/highlight it. */
export interface ControlHandle {
  readonly id: string;
  readonly fieldEl: HTMLElement;
  setVisible(visible: boolean): void;
  setEnabled(enabled: boolean): void;
  setHighlighted(highlighted: boolean): void;
  /** Reflects a programmatic value change (e.g. from a lesson step) in the input/select. No-op for buttons. */
  setValue(value: string | number): void;
}

const MIN_DECK_SIZE = 2;
const MAX_DECK_SIZE = 300;
const NUM_DECKS_PRESETS = [1, 500, 2000];

/** Matches the mobile breakpoint in style.css so the settings dialog's open/modal state stays in sync with the layout. */
const MOBILE_MEDIA_QUERY = "(max-width: 760px)";

function numDecksLabel(n: number): string {
  return n === 1 ? "1 trial" : `${n} trials`;
}

/**
 * Builds the sandbox control panel and exposes each control by id
 * (`deckSize`, `numDecks`, `colorScheme`, `trackedCard`, `shuffleOnce`,
 * `shuffleFive`, `cut`, `overhand`, `perfectShuffle`, `reset`) so a guided
 * lesson can later hide, disable, or highlight individual controls
 * programmatically without touching this file.
 *
 * On mobile, `deckSize`/`numDecks`/`colorScheme` physically live inside a
 * `<dialog>` opened from a compact status bar (tap-to-open readout chips +
 * hamburger), while `trackedCard` lives directly on the status bar as the
 * one control that stays truly interactive there. On desktop the dialog and
 * the status bar's Track Card row are both flattened via `display: contents`
 * in style.css, so every field renders inline in the sidebar exactly as
 * before — same DOM nodes, same `ControlHandle`s, just relaid-out by CSS.
 */
export class ControlsPanel {
  private controls = new Map<string, ControlHandle>();
  private trackedCardSlider: HTMLInputElement | null = null;
  private trackedCardPlayButton: HTMLButtonElement | null = null;
  private modeTabsSlot!: HTMLElement;
  private hamburgerBtn!: HTMLButtonElement;

  constructor(container: HTMLElement, initial: ControlsInitial, callbacks: ControlsCallbacks) {
    container.innerHTML = "";

    const form = document.createElement("div");
    form.className = "controls-form";
    container.appendChild(form);

    // Settings dialog: deck size, number of decks, color scheme, and (on
    // mobile only) the Sandbox/Explainer mode toggle. `display: contents`
    // on desktop flattens it into the sidebar; on mobile it's a real
    // bottom-sheet <dialog>, opened from the status bar built below.
    const dialog = document.createElement("dialog");
    dialog.className = "settings-dialog";
    form.appendChild(dialog);

    const dialogHeader = document.createElement("div");
    dialogHeader.className = "settings-dialog-header";
    const dialogTitle = document.createElement("span");
    dialogTitle.className = "settings-dialog-title";
    dialogTitle.textContent = "Settings";
    const dialogClose = document.createElement("button");
    dialogClose.type = "button";
    dialogClose.className = "settings-dialog-close";
    dialogClose.setAttribute("aria-label", "Close settings");
    dialogClose.textContent = "✕";
    dialogClose.addEventListener("click", () => dialog.close());
    dialogHeader.append(dialogTitle, dialogClose);
    dialog.appendChild(dialogHeader);

    // Tap-to-open status bar chips, built before the fields below so they
    // can be passed in as highlight/visibility/value mirrors.
    const deckSizeChip = this.createStatusChip(() => dialog.showModal());
    const numDecksChip = this.createStatusChip(() => dialog.showModal());
    this.hamburgerBtn = document.createElement("button");
    this.hamburgerBtn.type = "button";
    this.hamburgerBtn.className = "hamburger-btn";
    this.hamburgerBtn.setAttribute("aria-label", "Open settings");
    this.hamburgerBtn.innerHTML = HAMBURGER_ICON_SVG;
    this.hamburgerBtn.addEventListener("click", () => dialog.showModal());

    this.registerNumberField(dialog, {
      id: "deckSize",
      label: "Deck size",
      min: MIN_DECK_SIZE,
      max: MAX_DECK_SIZE,
      value: initial.deckSize,
      onCommit: (v) => callbacks.onDeckSizeChange(v),
      mirror: deckSizeChip,
      mirrorLabel: (v) => `${v} cards`,
      flashHamburger: true,
    });
    this.get("deckSize").setValue(initial.deckSize);

    this.registerSegmentedField(dialog, {
      id: "numDecks",
      label: "Number of decks",
      options: NUM_DECKS_PRESETS.map((n) => ({ value: n, label: String(n) })),
      value: initial.numDecks,
      onChange: (v) => callbacks.onNumDecksChange(v),
      mirror: numDecksChip,
      mirrorLabel: numDecksLabel,
      flashHamburger: true,
    });
    this.get("numDecks").setValue(initial.numDecks);

    this.registerSelectField(dialog, {
      id: "colorScheme",
      label: "Color scheme",
      value: initial.colorSchemeId,
      options: COLOR_SCHEMES.map((s) => ({ value: s.id, label: s.label })),
      onChange: (v) => callbacks.onColorSchemeChange(v),
      flashHamburger: true,
    });

    this.modeTabsSlot = document.createElement("div");
    this.modeTabsSlot.className = "settings-mode-tabs";
    dialog.appendChild(this.modeTabsSlot);

    // Click on the backdrop (or the dialog's own unoccupied padding) closes it.
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });

    // Track Card row: the one control that stays truly interactive on the
    // mobile status bar itself, shown only when there's more than one deck
    // to distinguish. Flattened inline via `display: contents` on desktop,
    // same trick as the dialog above.
    const row2 = document.createElement("div");
    row2.className = "status-bar-row2";
    form.appendChild(row2);
    this.registerTrackedCardField(row2, {
      id: "trackedCard",
      label: "Track card # (0 = top)",
      min: 0,
      max: initial.deckSize - 1,
      value: initial.trackedCard,
      onInput: (v) => callbacks.onTrackedCardChange(v),
      onTogglePlay: () => callbacks.onTrackedCardPlayToggle(),
    });
    this.get("trackedCard").setVisible(initial.numDecks !== 1);

    // Status bar: mobile-only row of tap-to-open readouts + hamburger.
    // Hidden entirely on desktop, where editing happens inline above.
    const statusBar = document.createElement("div");
    statusBar.className = "status-bar";
    statusBar.append(deckSizeChip, numDecksChip, this.hamburgerBtn);
    form.appendChild(statusBar);

    const actions = document.createElement("div");
    actions.className = "control-field control-actions";
    form.appendChild(actions);

    this.registerButton(actions, {
      id: "shuffleOnce",
      label: "Shuffle",
      primary: true,
      icon: OPERATION_ICON_SVG.riffle,
      onClick: () => callbacks.onShuffle(1),
    });
    this.registerButton(actions, {
      id: "shuffleFive",
      label: "Shuffle ×5",
      icon: OPERATION_ICON_SVG.riffle,
      onClick: () => callbacks.onShuffle(5),
    });
    this.registerButton(actions, {
      id: "cut",
      label: "Cut",
      icon: OPERATION_ICON_SVG.cut,
      onClick: () => callbacks.onCut(),
    });
    this.registerButton(actions, {
      id: "overhand",
      label: "Overhand",
      icon: OPERATION_ICON_SVG.overhand,
      onClick: () => callbacks.onOverhand(),
    });
    this.registerButton(actions, {
      id: "perfectShuffle",
      label: "Perfect Shuffle",
      icon: OPERATION_ICON_SVG.riffle,
      onClick: () => callbacks.onPerfectShuffle(),
    });
    this.registerButton(actions, {
      id: "reset",
      label: "Reset",
      danger: true,
      onClick: () => callbacks.onReset(),
    });

    // On desktop the dialog stays non-modally open (and thus interactive)
    // inline in the sidebar; on mobile it starts closed, only appearing via
    // showModal() from the status bar. Track the breakpoint live so
    // resizing/rotating across it doesn't strand the dialog half-open or
    // leave the rest of the page inert behind a stale modal.
    const mobileQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const syncDialogToViewport = () => {
      if (mobileQuery.matches) {
        if (!dialog.matches(":modal")) dialog.close();
      } else {
        dialog.close();
        dialog.show();
      }
    };
    syncDialogToViewport();
    mobileQuery.addEventListener("change", syncDialogToViewport);

    // On mobile this panel is pinned via position:fixed rather than normal
    // flow (see #controls-panel in style.css), so #viz-panel needs its own
    // height reserved via padding-bottom -- publish the panel's live
    // rendered height as a custom property rather than hardcoding a guess,
    // so it stays correct as content changes (e.g. the Track Card row
    // showing/hiding).
    const syncControlsHeight = () => {
      document.documentElement.style.setProperty("--controls-panel-height", `${container.offsetHeight}px`);
    };
    new ResizeObserver(syncControlsHeight).observe(container);
  }

  get(id: string): ControlHandle {
    const handle = this.controls.get(id);
    if (!handle) throw new Error(`Unknown control id: ${id}`);
    return handle;
  }

  /** Where app.ts injects the mobile copy of the Sandbox/Explainer mode toggle. */
  getModeTabsSlot(): HTMLElement {
    return this.modeTabsSlot;
  }

  /** Reflects the current play/pause state on the Track Card play button. */
  setTrackedCardPlaying(playing: boolean): void {
    if (!this.trackedCardPlayButton) return;
    this.trackedCardPlayButton.innerHTML = playing ? PAUSE_ICON_SVG : PLAY_ICON_SVG;
    this.trackedCardPlayButton.classList.toggle("is-playing", playing);
    this.trackedCardPlayButton.setAttribute("aria-label", playing ? "Pause" : "Play");
  }

  /** Keeps the Track Card slider's range in sync with the current deck size. */
  setTrackedCardMax(max: number): void {
    if (this.trackedCardSlider) this.trackedCardSlider.max = String(max);
  }

  private createStatusChip(onClick: () => void): HTMLButtonElement {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "status-chip";
    const valueEl = document.createElement("span");
    valueEl.className = "status-chip-value";
    chip.appendChild(valueEl);
    chip.addEventListener("click", onClick);
    return chip;
  }

  private setChipValue(chip: HTMLElement, text: string): void {
    const valueEl = chip.querySelector<HTMLElement>(".status-chip-value");
    if (valueEl) valueEl.textContent = text;
  }

  private registerHandle(
    id: string,
    fieldEl: HTMLElement,
    setValue: (value: string | number) => void = () => {},
    opts?: { mirror?: HTMLElement; flashHamburger?: boolean },
  ): ControlHandle {
    const handle: ControlHandle = {
      id,
      fieldEl,
      setVisible: (visible) => {
        fieldEl.classList.toggle("is-hidden", !visible);
        opts?.mirror?.classList.toggle("is-hidden", !visible);
      },
      setEnabled: (enabled) => {
        fieldEl.classList.toggle("is-disabled", !enabled);
        fieldEl
          .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
            "input, select, button",
          )
          .forEach((el) => (el.disabled = !enabled));
      },
      setHighlighted: (highlighted) => {
        fieldEl.classList.toggle("is-highlighted", highlighted);
        opts?.mirror?.classList.toggle("is-highlighted", highlighted);
        if (opts?.flashHamburger) this.hamburgerBtn.classList.toggle("is-highlighted", highlighted);
      },
      setValue,
    };
    this.controls.set(id, handle);
    return handle;
  }

  private registerNumberField(
    form: HTMLElement,
    opts: {
      id: string;
      label: string;
      min: number;
      max: number;
      value: number;
      onCommit: (value: number) => void;
      mirror?: HTMLElement;
      mirrorLabel?: (value: number) => string;
      flashHamburger?: boolean;
    },
  ): void {
    const field = document.createElement("label");
    field.className = "control-field";
    field.dataset.controlId = opts.id;

    const labelEl = document.createElement("span");
    labelEl.className = "control-label";
    labelEl.textContent = opts.label;

    const input = document.createElement("input");
    input.type = "number";
    input.min = String(opts.min);
    input.max = String(opts.max);
    input.value = String(opts.value);

    const commit = () => {
      const clamped = Math.min(opts.max, Math.max(opts.min, Math.round(Number(input.value) || opts.min)));
      input.value = String(clamped);
      opts.onCommit(clamped);
    };
    input.addEventListener("change", commit);

    field.append(labelEl, input);
    form.appendChild(field);
    this.registerHandle(
      opts.id,
      field,
      (value) => {
        input.value = String(value);
        if (opts.mirror) this.setChipValue(opts.mirror, opts.mirrorLabel ? opts.mirrorLabel(Number(value)) : String(value));
      },
      { mirror: opts.mirror, flashHamburger: opts.flashHamburger },
    );
  }

  private registerSegmentedField(
    form: HTMLElement,
    opts: {
      id: string;
      label: string;
      options: Array<{ value: number; label: string }>;
      value: number;
      onChange: (value: number) => void;
      mirror?: HTMLElement;
      mirrorLabel?: (value: number) => string;
      flashHamburger?: boolean;
    },
  ): void {
    const field = document.createElement("div");
    field.className = "control-field";
    field.dataset.controlId = opts.id;

    const labelEl = document.createElement("span");
    labelEl.className = "control-label";
    labelEl.textContent = opts.label;

    const group = document.createElement("div");
    group.className = "segmented-group";

    const buttons = opts.options.map((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "segmented-option";
      btn.textContent = option.label;
      btn.classList.toggle("active", option.value === opts.value);
      btn.addEventListener("click", () => {
        for (const b of buttons) b.classList.remove("active");
        btn.classList.add("active");
        opts.onChange(option.value);
      });
      group.appendChild(btn);
      return btn;
    });

    field.append(labelEl, group);
    form.appendChild(field);
    this.registerHandle(
      opts.id,
      field,
      (value) => {
        const numeric = Number(value);
        buttons.forEach((btn, i) => btn.classList.toggle("active", opts.options[i].value === numeric));
        if (opts.mirror) this.setChipValue(opts.mirror, opts.mirrorLabel ? opts.mirrorLabel(numeric) : String(numeric));
      },
      { mirror: opts.mirror, flashHamburger: opts.flashHamburger },
    );
  }

  private registerTrackedCardField(
    form: HTMLElement,
    opts: {
      id: string;
      label: string;
      min: number;
      max: number;
      value: number;
      onInput: (value: number) => void;
      onTogglePlay: () => void;
    },
  ): void {
    const field = document.createElement("div");
    field.className = "control-field";
    field.dataset.controlId = opts.id;

    const labelEl = document.createElement("span");
    labelEl.className = "control-label";
    labelEl.textContent = opts.label;

    const row = document.createElement("div");
    row.className = "track-card-row";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "track-card-slider";
    slider.min = String(opts.min);
    slider.max = String(opts.max);
    slider.value = String(opts.value);

    const valueEl = document.createElement("span");
    valueEl.className = "track-card-value";
    valueEl.textContent = String(opts.value);

    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.className = "btn btn-play";
    playButton.innerHTML = PLAY_ICON_SVG;
    playButton.setAttribute("aria-label", "Play");

    slider.addEventListener("input", () => {
      const v = Number(slider.value);
      valueEl.textContent = String(v);
      opts.onInput(v);
    });
    playButton.addEventListener("click", () => opts.onTogglePlay());

    row.append(slider, valueEl, playButton);
    field.append(labelEl, row);
    form.appendChild(field);

    this.trackedCardSlider = slider;
    this.trackedCardPlayButton = playButton;

    this.registerHandle(opts.id, field, (value) => {
      const v = Number(value);
      slider.value = String(v);
      valueEl.textContent = String(v);
    });
  }

  private registerSelectField(
    form: HTMLElement,
    opts: {
      id: string;
      label: string;
      value: string;
      options: Array<{ value: string; label: string }>;
      onChange: (value: string) => void;
      flashHamburger?: boolean;
    },
  ): void {
    const field = document.createElement("label");
    field.className = "control-field";
    field.dataset.controlId = opts.id;

    const labelEl = document.createElement("span");
    labelEl.className = "control-label";
    labelEl.textContent = opts.label;

    const select = document.createElement("select");
    for (const option of opts.options) {
      const optionEl = document.createElement("option");
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      if (option.value === opts.value) optionEl.selected = true;
      select.appendChild(optionEl);
    }
    select.addEventListener("change", () => opts.onChange(select.value));

    field.append(labelEl, select);
    form.appendChild(field);
    this.registerHandle(
      opts.id,
      field,
      (value) => {
        select.value = String(value);
      },
      { flashHamburger: opts.flashHamburger },
    );
  }

  private registerButton(
    container: HTMLElement,
    opts: { id: string; label: string; primary?: boolean; danger?: boolean; icon?: string; onClick: () => void },
  ): void {
    const field = document.createElement("div");
    field.className = "control-field control-button-field";
    field.dataset.controlId = opts.id;

    const button = document.createElement("button");
    button.type = "button";
    button.className = opts.primary ? "btn btn-primary" : opts.danger ? "btn btn-danger" : "btn";
    if (opts.icon) {
      const iconEl = document.createElement("span");
      iconEl.className = "btn-icon";
      iconEl.innerHTML = opts.icon;
      button.appendChild(iconEl);
    }
    button.appendChild(document.createTextNode(opts.label));
    button.addEventListener("click", opts.onClick);

    field.appendChild(button);
    container.appendChild(field);
    this.registerHandle(opts.id, field);
  }
}
