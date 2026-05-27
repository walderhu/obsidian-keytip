const { Modal, Platform, Plugin } = require("obsidian");
const LEGACY_VIEW_TYPE = "key-tip-view";
const MODIFIER_ORDER = ["Mod", "Alt", "Shift"];

const KEYBOARD_ROWS = [
  [
    { key: "Escape", label: "Esc" },
    { key: "F1", label: "F1" },
    { key: "F2", label: "F2" },
    { key: "F3", label: "F3" },
    { key: "F4", label: "F4" },
    { key: "F5", label: "F5" },
    { key: "F6", label: "F6" },
    { key: "F7", label: "F7" },
    { key: "F8", label: "F8" },
    { key: "F9", label: "F9" },
    { key: "F10", label: "F10" },
    { key: "F11", label: "F11" },
    { key: "F12", label: "F12" },
    { key: "Delete", label: "Del" },
    { decorative: true, label: "", className: "key-tip-power" },
  ],
  [
    { key: "`", label: "`" },
    { key: "1", label: "1" },
    { key: "2", label: "2" },
    { key: "3", label: "3" },
    { key: "4", label: "4" },
    { key: "5", label: "5" },
    { key: "6", label: "6" },
    { key: "7", label: "7" },
    { key: "8", label: "8" },
    { key: "9", label: "9" },
    { key: "0", label: "0" },
    { key: "-", label: "-" },
    { key: "=", label: "=" },
    { key: "Backspace", label: "Backspace", width: "xwide" },
  ],
  [
    { key: "Tab", label: "Tab", width: "wide" },
    { key: "Q", label: "Q" },
    { key: "W", label: "W" },
    { key: "E", label: "E" },
    { key: "R", label: "R" },
    { key: "T", label: "T" },
    { key: "Y", label: "Y" },
    { key: "U", label: "U" },
    { key: "I", label: "I" },
    { key: "O", label: "O" },
    { key: "P", label: "P" },
    { key: "[", label: "[" },
    { key: "]", label: "]" },
    { key: "\\", label: "\\", width: "wide" },
  ],
  [
    { key: "CapsLock", label: "Caps", width: "xwide" },
    { key: "A", label: "A" },
    { key: "S", label: "S" },
    { key: "D", label: "D" },
    { key: "F", label: "F" },
    { key: "G", label: "G" },
    { key: "H", label: "H" },
    { key: "J", label: "J" },
    { key: "K", label: "K" },
    { key: "L", label: "L" },
    { key: ";", label: ";" },
    { key: "'", label: "'" },
    { key: "Enter", label: "Enter", width: "xwide" },
  ],
  [
    { modifier: "Shift", label: "Shift", width: "shift" },
    { key: "Z", label: "Z" },
    { key: "X", label: "X" },
    { key: "C", label: "C" },
    { key: "V", label: "V" },
    { key: "B", label: "B" },
    { key: "N", label: "N" },
    { key: "M", label: "M" },
    { key: ",", label: "," },
    { key: ".", label: "." },
    { key: "/", label: "/" },
    { modifier: "Shift", label: "Shift", width: "shift" },
  ],
  [
    { modifier: "Mod", label: "Ctrl", width: "wide" },
    { decorative: true, label: "Fn" },
    { decorative: true, label: "⊞" },
    { modifier: "Alt", label: "Alt", width: "wide" },
    { key: "Space", label: "Space", width: "laptop-space" },
    { modifier: "Alt", label: "Alt", width: "wide" },
    { modifier: "Mod", label: "Ctrl", width: "wide" },
    { key: "ArrowLeft", label: "←" },
    { arrowStack: true },
    { key: "ArrowRight", label: "→" },
  ],
];

function modifierText(modifier) {
  if (modifier === "Mod") {
    return Platform.isMacOS ? "Cmd" : "Ctrl";
  }
  return modifier;
}

function normalizeKey(key) {
  const aliases = {
    " ": "Space",
    Spacebar: "Space",
    Left: "ArrowLeft",
    Right: "ArrowRight",
    Up: "ArrowUp",
    Down: "ArrowDown",
    Esc: "Escape",
    Del: "Delete",
  };
  const normalized = aliases[key] || key;
  return normalized.length === 1 ? normalized.toUpperCase() : normalized;
}

function normalizeModifiers(modifiers) {
  const unique = new Set(
    (modifiers || []).map((modifier) => {
      if (modifier === "Ctrl" && !Platform.isMacOS) {
        return "Mod";
      }
      if (modifier === "Meta" && Platform.isMacOS) {
        return "Mod";
      }
      return modifier;
    })
  );
  return MODIFIER_ORDER.filter((modifier) => unique.has(modifier));
}

function hotkeyId(modifiers, key) {
  return `${normalizeModifiers(modifiers).join("+")}|${normalizeKey(key)}`;
}

function shortcutText(modifiers, key) {
  const parts = normalizeModifiers(modifiers).map(modifierText);
  parts.push(key);
  return parts.join(" + ");
}

function hotkeyKeyFromEvent(event) {
  const codeKeys = {
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Space: "Space",
  };
  if (codeKeys[event.code]) {
    return codeKeys[event.code];
  }
  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3);
  }
  if (/^Digit[0-9]$/.test(event.code)) {
    return event.code.slice(5);
  }
  return normalizeKey(event.key);
}

class KeyTipModal extends Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.lockedModifiers = new Set();
    this.heldModifiers = new Set();
    this.keyEls = [];
  }

  onOpen() {
    this.modalEl.addClass("key-tip-modal");
    this.titleEl.setText("Key Tip");
    this.render();
  }

  render() {
    const activeModifiers = this.getActiveModifiers();
    const assignments = this.plugin.getAssignments();
    this.contentEl.empty();
    this.keyEls = [];

    const header = this.contentEl.createDiv({ cls: "key-tip-header" });
    header.createSpan({ cls: "key-tip-layout-label", text: "Клавиатура 75%" });

    this.contentEl.createDiv({
      cls: "key-tip-help",
      text: "Наведите на клавишу или кликните ее для поиска в Hotkeys. Ctrl, Shift и Alt переключают слой.",
    });

    const layer = this.contentEl.createDiv({ cls: "key-tip-layer" });
    layer.createSpan({ text: "Слой:" });
    if (!activeModifiers.length) {
      layer.createSpan({ cls: "key-tip-layer-empty", text: "без модификаторов" });
    }
    activeModifiers.forEach((modifier) => {
      layer.createSpan({ cls: "key-tip-chip", text: modifierText(modifier) });
    });
    if (this.lockedModifiers.size) {
      const clear = layer.createEl("button", {
        cls: "key-tip-clear",
        text: "Сбросить",
        attr: { type: "button" },
      });
      clear.addEventListener("click", () => {
        this.lockedModifiers.clear();
        this.render();
      });
    }

    const board = this.contentEl.createDiv({ cls: "key-tip-board" });
    KEYBOARD_ROWS.forEach((row, index) => {
      const rowEl = board.createDiv({ cls: `key-tip-row key-tip-row-${index + 1}` });
      row.forEach((key) => this.renderKey(rowEl, key, activeModifiers, assignments));
    });

    this.detailEl = this.contentEl.createDiv({ cls: "key-tip-detail" });
    this.detailEl.setText("Наведите на клавишу, чтобы посмотреть действие.");
  }

  renderKey(parent, keyInfo, modifiers, assignments) {
    if (keyInfo.arrowStack) {
      const stack = parent.createDiv({ cls: "key-tip-arrow-stack" });
      this.renderKey(stack, { key: "ArrowUp", label: "↑" }, modifiers, assignments);
      this.renderKey(stack, { key: "ArrowDown", label: "↓" }, modifiers, assignments);
      return;
    }
    if (keyInfo.spacer) {
      parent.createDiv({ cls: "key-tip-spacer" });
      return;
    }
    if (keyInfo.decorative) {
      const button = parent.createEl("button", {
        cls: `key-tip-key is-decorative ${keyInfo.className || ""}`,
        text: keyInfo.label,
        attr: { type: "button", disabled: "true" },
      });
      button.setAttr("aria-hidden", "true");
      return;
    }
    if (keyInfo.modifier) {
      const button = parent.createEl("button", {
        cls: `key-tip-key key-tip-modifier key-tip-${keyInfo.width || "normal"}`,
        text: modifierText(keyInfo.modifier),
        attr: { type: "button" },
      });
      const active = modifiers.includes(keyInfo.modifier);
      button.toggleClass("is-active", active);
      button.setAttr("title", active ? "Убрать модификатор из слоя" : "Добавить модификатор в слой");
      button.addEventListener("click", () => this.toggleModifier(keyInfo.modifier));
      return;
    }

    const actions = assignments.get(hotkeyId(modifiers, keyInfo.key)) || [];
    const actionNames = actions.map((action) => action.name);
    const combination = shortcutText(modifiers, keyInfo.label);
    const button = parent.createEl("button", {
      cls: `key-tip-key key-tip-${keyInfo.width || "normal"}`,
      text: keyInfo.label,
      attr: { type: "button" },
    });
    button.toggleClass("has-command", actions.length > 0);
    button.toggleClass("has-conflict", actions.length > 1);
    button.setAttr(
      "title",
      actions.length
        ? `${combination}: ${actionNames.join("; ")}${actions.length > 1 ? " (конфликт)" : ""}`
        : `${combination}: действие не назначено`
    );
    button.addEventListener("click", () => this.plugin.openHotkeySearch(combination, actions));
    button.addEventListener("mouseenter", () => {
      if (!this.detailEl) {
        return;
      }
      this.detailEl.empty();
      this.detailEl.createDiv({ cls: "key-tip-combination", text: combination });
      if (!actions.length) {
        this.detailEl.createDiv({ cls: "key-tip-unassigned", text: "Действие не назначено" });
        return;
      }
      if (actions.length > 1) {
        this.detailEl.createDiv({ cls: "key-tip-conflict-note", text: "Конфликт: сочетание назначено несколько раз" });
      }
      actions.forEach((action) => this.detailEl.createDiv({ cls: "key-tip-action", text: action.name }));
    });
    this.keyEls.push(button);
  }

  toggleModifier(modifier) {
    if (this.lockedModifiers.has(modifier)) {
      this.lockedModifiers.delete(modifier);
    } else {
      this.lockedModifiers.add(modifier);
    }
    this.render();
  }

  getActiveModifiers() {
    return normalizeModifiers([...this.lockedModifiers, ...this.heldModifiers]);
  }

  setHeldModifier(modifier, pressed) {
    const previous = this.getActiveModifiers().join("+");
    if (pressed) {
      this.heldModifiers.add(modifier);
    } else {
      this.heldModifiers.delete(modifier);
    }
    if (previous !== this.getActiveModifiers().join("+")) {
      this.render();
    }
  }

  clearHeldModifiers() {
    if (this.heldModifiers.size) {
      this.heldModifiers.clear();
      this.render();
    }
  }

  onClose() {
    if (this.plugin.modal === this) {
      this.plugin.modal = null;
    }
    this.contentEl.empty();
  }
}

class KeyTipPlugin extends Plugin {
  onload() {
    this.app.workspace.detachLeavesOfType(LEGACY_VIEW_TYPE);
    this.addRibbonIcon("keyboard", "Open Key Tip", () => this.openModal());
    this.addCommand({
      id: "open-key-tip",
      name: "Open keyboard hotkey hints",
      callback: () => this.openModal(),
    });

    this.registerDomEvent(window, "keydown", (event) => this.handleModifierEvent(event, true), true);
    this.registerDomEvent(window, "keyup", (event) => this.handleModifierEvent(event, false), true);
    this.registerDomEvent(window, "blur", () => this.modal?.clearHeldModifiers());
  }

  onunload() {
    this.stopHotkeyCapture();
    this.modal?.close();
  }

  openModal() {
    this.modal?.close();
    this.modal = new KeyTipModal(this);
    this.modal.open();
  }

  openHotkeySearch(combination, actions) {
    this.modal?.close();
    const settings = this.app.setting;
    if (!settings?.openTabById) {
      return;
    }
    settings.open?.();
    settings.openTabById("hotkeys");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => this.filterHotkeys(combination, actions));
    });
  }

  filterHotkeys(combination, actions = []) {
    const tab = this.app.setting?.settingTabs?.find((settingTab) => settingTab.id === "hotkeys");
    const container = tab?.containerEl || document.querySelector(".hotkey-list-container")?.parentElement;
    if (!container) {
      return;
    }
    const input = container.querySelector("input[type='search'], input[type='text'], input");
    if (input) {
      this.setHotkeyFilterValue(input, "");
      if (!input.dataset.keyTipFilterBound) {
        input.dataset.keyTipFilterBound = "true";
        input.addEventListener("input", () => {
          if (input.value.trim()) {
            this.clearHotkeyFilter(container);
          }
        });
      }
    }
    window.requestAnimationFrame(() => {
      this.ensureHotkeyFilterControls(container);
      this.applyHotkeyFilter(container, combination, actions);
    });
  }

  setHotkeyFilterValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus();
  }

  applyHotkeyFilter(container, combination, actions) {
    this.clearHotkeyRows(container);
    const list = container.querySelector(".hotkey-list-container") || container;
    const actionNames = new Set(actions.map((action) => action.name));
    const rows = list.querySelectorAll(".setting-item:not(.setting-item-heading)");
    rows.forEach((row) => {
      const name = row.querySelector(".setting-item-name")?.textContent?.trim();
      row.toggleClass("key-tip-hotkey-hidden", !actionNames.has(name));
    });

    this.activeHotkeyFilter = { combination, actions, container };
    const button = container.querySelector(".key-tip-hotkey-capture");
    if (button) {
      button.setText(`⌨ ${combination}`);
      button.addClass("is-active");
    }
  }

  ensureHotkeyFilterControls(container) {
    const input = container.querySelector("input[type='search'], input[type='text'], input");
    const searchContainer = input?.closest(".search-input-container") || input?.parentElement;
    const existingControls = container.querySelector(".key-tip-hotkey-controls");
    if (existingControls) {
      if (searchContainer && existingControls.parentElement === searchContainer) {
        searchContainer.insertAdjacentElement("afterend", existingControls);
      }
      return;
    }
    const controls = document.createElement("div");
    controls.className = "key-tip-hotkey-controls";
    const capture = controls.createEl("button", {
      cls: "key-tip-hotkey-capture",
      text: "⌨ По сочетанию",
      attr: { type: "button", title: "Фильтровать команды по нажатому сочетанию" },
    });
    capture.addEventListener("click", () => this.startHotkeyCapture(container));
    const reset = controls.createEl("button", {
      cls: "key-tip-hotkey-reset",
      text: "×",
      attr: { type: "button", title: "Сбросить фильтр сочетания" },
    });
    reset.addEventListener("click", () => this.clearHotkeyFilter(container));
    if (searchContainer) {
      searchContainer.insertAdjacentElement("afterend", controls);
    } else {
      container.prepend(controls);
    }
  }

  startHotkeyCapture(container) {
    this.stopHotkeyCapture();
    const button = container.querySelector(".key-tip-hotkey-capture");
    button?.setText("Нажмите сочетание...");
    button?.addClass("is-recording");
    this.hotkeyCaptureHandler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.stopHotkeyCapture();
        this.updateHotkeyFilterButton(container);
        return;
      }
      if (["Control", "Meta", "Alt", "Shift"].includes(event.key)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const modifiers = [];
      if ((Platform.isMacOS && event.metaKey) || (!Platform.isMacOS && event.ctrlKey)) {
        modifiers.push("Mod");
      }
      if (event.altKey) {
        modifiers.push("Alt");
      }
      if (event.shiftKey) {
        modifiers.push("Shift");
      }
      const key = hotkeyKeyFromEvent(event);
      const actions = this.getAssignments().get(hotkeyId(modifiers, key)) || [];
      this.stopHotkeyCapture();
      this.applyHotkeyFilter(container, shortcutText(modifiers, key), actions);
    };
    window.addEventListener("keydown", this.hotkeyCaptureHandler, true);
  }

  stopHotkeyCapture() {
    if (this.hotkeyCaptureHandler) {
      window.removeEventListener("keydown", this.hotkeyCaptureHandler, true);
      this.hotkeyCaptureHandler = null;
    }
    document.querySelectorAll(".key-tip-hotkey-capture.is-recording").forEach((button) => {
      button.removeClass("is-recording");
    });
  }

  updateHotkeyFilterButton(container) {
    const button = container.querySelector(".key-tip-hotkey-capture");
    if (!button) {
      return;
    }
    const active = this.activeHotkeyFilter?.container === container;
    button.setText(active ? `⌨ ${this.activeHotkeyFilter.combination}` : "⌨ По сочетанию");
    button.toggleClass("is-active", active);
  }

  clearHotkeyRows(container) {
    container.querySelectorAll(".key-tip-hotkey-hidden").forEach((row) => {
      row.removeClass("key-tip-hotkey-hidden");
    });
  }

  clearHotkeyFilter(container) {
    this.stopHotkeyCapture();
    this.clearHotkeyRows(container);
    if (this.activeHotkeyFilter?.container === container) {
      this.activeHotkeyFilter = null;
    }
    this.updateHotkeyFilterButton(container);
  }

  handleModifierEvent(event, pressed) {
    const modifiers = {
      Control: Platform.isMacOS ? "Ctrl" : "Mod",
      Meta: Platform.isMacOS ? "Mod" : "Meta",
      Alt: "Alt",
      Shift: "Shift",
    };
    const modifier = modifiers[event.key];
    if (modifier && MODIFIER_ORDER.includes(modifier)) {
      this.modal?.setHeldModifier(modifier, pressed);
    }
  }

  getAssignments() {
    const assignments = new Map();
    const commands = Object.values(this.app.commands.commands || {});
    commands.forEach((command) => {
      const hotkeys = this.app.hotkeyManager.getHotkeys(command.id) || [];
      hotkeys.forEach((hotkey) => {
        const id = hotkeyId(hotkey.modifiers, hotkey.key);
        const actions = assignments.get(id) || [];
        actions.push({ id: command.id, name: command.name || command.id });
        assignments.set(id, actions);
      });
    });
    return assignments;
  }
}

module.exports = KeyTipPlugin;
