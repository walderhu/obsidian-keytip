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
    header.createEl("button", {
      cls: "key-tip-refresh",
      text: "Обновить",
      attr: { type: "button" },
    }).addEventListener("click", () => this.render());

    this.contentEl.createDiv({
      cls: "key-tip-help",
      text: "Наведите на клавишу. Удерживайте Ctrl, Shift или Alt либо кликните их для фиксации слоя.",
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
    const combination = shortcutText(modifiers, keyInfo.label);
    const button = parent.createEl("button", {
      cls: `key-tip-key key-tip-${keyInfo.width || "normal"}`,
      text: keyInfo.label,
      attr: { type: "button" },
    });
    button.toggleClass("has-command", actions.length > 0);
    button.setAttr(
      "title",
      actions.length ? `${combination}: ${actions.join("; ")}` : `${combination}: действие не назначено`
    );
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
      actions.forEach((action) => this.detailEl.createDiv({ cls: "key-tip-action", text: action }));
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
    this.modal?.close();
  }

  openModal() {
    this.modal?.close();
    this.modal = new KeyTipModal(this);
    this.modal.open();
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
        actions.push(command.name || command.id);
        assignments.set(id, actions);
      });
    });
    return assignments;
  }
}

module.exports = KeyTipPlugin;
