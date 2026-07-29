import { COLOR_SCHEMES } from "../core/colors";
import { OPERATION_ICON_SVG } from "../viz/icons";

const PLAY_ICON_SVG = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4 2.5v11l10-5.5-10-5.5z"/></svg>`;
const PAUSE_ICON_SVG = `<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="2.5" width="3.4" height="11" rx="0.6"/><rect x="9.1" y="2.5" width="3.4" height="11" rx="0.6"/></svg>`;

export interface ControlsCallbacks {
  onDeckSizeChange(size: number): void;
  onNumDecksChange(numDecks: number): void;
  onColorSchemeChange(colorSchemeId: string): void;
  onTrackedCardChange(card: number): void;
  onTrackedCardPlayToggle(): void;
  onShuffle(times: number): void;
  onCut(): void;
  onOverhand(): void;
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

/**
 * Builds the sandbox control panel and exposes each control by id
 * (`deckSize`, `numDecks`, `colorScheme`, `trackedCard`, `shuffleOnce`,
 * `shuffleFive`, `cut`, `overhand`, `reset`) so a guided lesson can later
 * hide, disable, or highlight individual controls programmatically
 * without touching this file.
 */
export class ControlsPanel {
  private controls = new Map<string, ControlHandle>();
  private trackedCardSlider: HTMLInputElement | null = null;
  private trackedCardPlayButton: HTMLButtonElement | null = null;

  constructor(container: HTMLElement, initial: ControlsInitial, callbacks: ControlsCallbacks) {
    container.innerHTML = "";

    const form = document.createElement("div");
    form.className = "controls-form";
    container.appendChild(form);

    this.registerNumberField(form, {
      id: "deckSize",
      label: "Deck size",
      min: MIN_DECK_SIZE,
      max: MAX_DECK_SIZE,
      value: initial.deckSize,
      onCommit: (v) => callbacks.onDeckSizeChange(v),
    });

    this.registerSegmentedField(form, {
      id: "numDecks",
      label: "Number of decks",
      options: NUM_DECKS_PRESETS.map((n) => ({ value: n, label: String(n) })),
      value: initial.numDecks,
      onChange: (v) => callbacks.onNumDecksChange(v),
    });

    this.registerSelectField(form, {
      id: "colorScheme",
      label: "Color scheme",
      value: initial.colorSchemeId,
      options: COLOR_SCHEMES.map((s) => ({ value: s.id, label: s.label })),
      onChange: (v) => callbacks.onColorSchemeChange(v),
    });

    this.registerTrackedCardField(form, {
      id: "trackedCard",
      label: "Track card # (0 = top)",
      min: 0,
      max: initial.deckSize - 1,
      value: initial.trackedCard,
      onInput: (v) => callbacks.onTrackedCardChange(v),
      onTogglePlay: () => callbacks.onTrackedCardPlayToggle(),
    });
    this.get("trackedCard").setVisible(initial.numDecks !== 1);

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
      id: "reset",
      label: "Reset",
      danger: true,
      onClick: () => callbacks.onReset(),
    });
  }

  get(id: string): ControlHandle {
    const handle = this.controls.get(id);
    if (!handle) throw new Error(`Unknown control id: ${id}`);
    return handle;
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

  private registerHandle(
    id: string,
    fieldEl: HTMLElement,
    setValue: (value: string | number) => void = () => {},
  ): ControlHandle {
    const handle: ControlHandle = {
      id,
      fieldEl,
      setVisible: (visible) => fieldEl.classList.toggle("is-hidden", !visible),
      setEnabled: (enabled) => {
        fieldEl.classList.toggle("is-disabled", !enabled);
        fieldEl
          .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
            "input, select, button",
          )
          .forEach((el) => (el.disabled = !enabled));
      },
      setHighlighted: (highlighted) => fieldEl.classList.toggle("is-highlighted", highlighted),
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
    this.registerHandle(opts.id, field, (value) => {
      input.value = String(value);
    });
  }

  private registerSegmentedField(
    form: HTMLElement,
    opts: {
      id: string;
      label: string;
      options: Array<{ value: number; label: string }>;
      value: number;
      onChange: (value: number) => void;
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
    this.registerHandle(opts.id, field, (value) => {
      const numeric = Number(value);
      buttons.forEach((btn, i) => btn.classList.toggle("active", opts.options[i].value === numeric));
    });
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
    this.registerHandle(opts.id, field, (value) => {
      select.value = String(value);
    });
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
