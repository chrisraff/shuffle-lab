import { COLOR_SCHEMES } from "../core/colors";
import { VIZ_REGISTRY } from "../viz/registry";

export interface ControlsCallbacks {
  onDeckSizeChange(size: number): void;
  onNumDecksChange(numDecks: number): void;
  onColorSchemeChange(colorSchemeId: string): void;
  onVizChange(vizId: string): void;
  onTrackedCardChange(card: number): void;
  onShuffle(times: number): void;
  onCut(): void;
  onOverhand(): void;
  onReset(): void;
}

export interface ControlsInitial {
  deckSize: number;
  numDecks: number;
  colorSchemeId: string;
  vizId: string;
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
const MIN_NUM_DECKS = 1;
const MAX_NUM_DECKS = 2000;

/**
 * Builds the sandbox control panel and exposes each control by id
 * (`deckSize`, `numDecks`, `colorScheme`, `vizSelect`, `trackedCard`,
 * `shuffleOnce`, `shuffleFive`, `cut`, `overhand`, `reset`) so a guided
 * lesson can later hide, disable, or highlight individual controls
 * programmatically without touching this file.
 */
export class ControlsPanel {
  private controls = new Map<string, ControlHandle>();

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

    this.registerNumberField(form, {
      id: "numDecks",
      label: "Number of decks (trials)",
      min: MIN_NUM_DECKS,
      max: MAX_NUM_DECKS,
      value: initial.numDecks,
      onCommit: (v) => callbacks.onNumDecksChange(v),
    });

    this.registerSelectField(form, {
      id: "colorScheme",
      label: "Color scheme",
      value: initial.colorSchemeId,
      options: COLOR_SCHEMES.map((s) => ({ value: s.id, label: s.label })),
      onChange: (v) => callbacks.onColorSchemeChange(v),
    });

    this.registerSelectField(form, {
      id: "vizSelect",
      label: "Visualization",
      value: initial.vizId,
      options: VIZ_REGISTRY.map((v) => ({ value: v.id, label: v.label })),
      onChange: (v) => callbacks.onVizChange(v),
    });

    this.registerNumberField(form, {
      id: "trackedCard",
      label: "Track card # (0 = top)",
      min: 0,
      max: MAX_DECK_SIZE - 1,
      value: initial.trackedCard,
      onCommit: (v) => callbacks.onTrackedCardChange(v),
    });
    this.get("trackedCard").setVisible(initial.vizId === "follow-card");

    const actions = document.createElement("div");
    actions.className = "control-field control-actions";
    form.appendChild(actions);

    this.registerButton(actions, {
      id: "shuffleOnce",
      label: "Shuffle",
      primary: true,
      onClick: () => callbacks.onShuffle(1),
    });
    this.registerButton(actions, {
      id: "shuffleFive",
      label: "Shuffle ×5",
      onClick: () => callbacks.onShuffle(5),
    });
    this.registerButton(actions, {
      id: "cut",
      label: "Cut",
      onClick: () => callbacks.onCut(),
    });
    this.registerButton(actions, {
      id: "overhand",
      label: "Overhand",
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
    opts: { id: string; label: string; primary?: boolean; danger?: boolean; onClick: () => void },
  ): void {
    const field = document.createElement("div");
    field.className = "control-field control-button-field";
    field.dataset.controlId = opts.id;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = opts.label;
    button.className = opts.primary ? "btn btn-primary" : opts.danger ? "btn btn-danger" : "btn";
    button.addEventListener("click", opts.onClick);

    field.appendChild(button);
    container.appendChild(field);
    this.registerHandle(opts.id, field);
  }
}
