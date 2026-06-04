/**
 * Simple keyboard shortcut system
 * Finds elements with data-key attributes and sets up global key bindings.
 *
 * Also provides vim-style movement keys:
 *   h / ArrowLeft  - previous nav tab
 *   l / ArrowRight - next nav tab
 *   j / ArrowDown  - next list entry (from a tab, jumps to the first entry)
 *   k / ArrowUp    - previous list entry (from the first entry, back to the tab)
 */
declare global {
  interface Window {
    refreshKeyboardShortcuts: () => void;
  }
}

const keyMap = new Map();

const VERTICAL_NEXT = ["arrowdown", "j"];
const VERTICAL_PREV = ["arrowup", "k"];
const HORIZONTAL_NEXT = ["arrowright", "l"];
const HORIZONTAL_PREV = ["arrowleft", "h"];

function initKeyboardShortcuts() {
  // Clear existing mappings
  keyMap.clear();

  // Find all elements with data-key attribute
  const elements = document.querySelectorAll("[data-key]");

  elements.forEach((element) => {
    const key = element.getAttribute("data-key").toLowerCase();

    // Store multiple elements for the same key if needed
    if (!keyMap.has(key)) {
      keyMap.set(key, []);
    }
    keyMap.get(key).push(element);
  });
}

// An element is considered visible if it participates in layout. This filters
// out the duplicate nav (top bar on desktop, bottom bar on mobile) so movement
// only ever targets the nav that's currently on screen.
function isVisible(element: Element) {
  return (element as HTMLElement).offsetParent !== null || element.getClientRects().length > 0;
}

function getTabs() {
  return Array.from(document.querySelectorAll<HTMLElement>(".nav-link")).filter(isVisible);
}

function getEntries() {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-nav-item]")).filter(isVisible);
}

// Returns true when the event was handled as a movement key.
function handleMovement(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  const active = document.activeElement as HTMLElement | null;

  const isEntry = !!active && active.hasAttribute("data-nav-item");
  const isTab = !!active && active.classList.contains("nav-link");

  if (VERTICAL_NEXT.includes(key)) {
    const entries = getEntries();
    if (!entries.length) return false;
    if (isEntry) {
      const i = entries.indexOf(active);
      if (i < entries.length - 1) entries[i + 1].focus();
      else return false; // already at the last entry, allow default scroll
    } else {
      // From a tab (or anywhere else) drop into the first list entry.
      entries[0].focus();
    }
    event.preventDefault();
    return true;
  }

  if (VERTICAL_PREV.includes(key)) {
    if (!isEntry) return false;
    const entries = getEntries();
    const i = entries.indexOf(active);
    if (i > 0) {
      entries[i - 1].focus();
    } else {
      // From the first entry, go back up to the current/first tab.
      const tabs = getTabs();
      const target = tabs.find((t) => t.classList.contains("current")) || tabs[0];
      if (!target) return false;
      target.focus();
    }
    event.preventDefault();
    return true;
  }

  if (HORIZONTAL_NEXT.includes(key) || HORIZONTAL_PREV.includes(key)) {
    const tabs = getTabs();
    if (!tabs.length) return false;
    let idx = isTab ? tabs.indexOf(active) : tabs.findIndex((t) => t.classList.contains("current"));
    if (idx === -1) idx = 0;
    const next = idx + (HORIZONTAL_NEXT.includes(key) ? 1 : -1);
    if (next < 0 || next >= tabs.length) return false;
    tabs[next].focus();
    event.preventDefault();
    return true;
  }

  return false;
}

function handleKeyPress(event: KeyboardEvent) {
  // Don't trigger shortcuts when typing in input fields
  if ((event.target as HTMLElement).matches("input, textarea, select")) {
    return;
  }

  // Don't trigger shortcuts when a modifier key is pressed
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  // Movement keys take precedence over click shortcuts.
  if (handleMovement(event)) {
    return;
  }

  const key = event.key.toLowerCase();

  if (keyMap.has(key)) {
    const elements = keyMap.get(key);

    elements.forEach((element) => {
      // Trigger click event on the element
      element.click();
    });

    // Prevent default action
    event.preventDefault();
  }
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initKeyboardShortcuts);
} else {
  initKeyboardShortcuts();
}

// Set up global keyboard listener
document.addEventListener("keydown", handleKeyPress);

// Expose a method to re-initialize if DOM changes
window.refreshKeyboardShortcuts = initKeyboardShortcuts;
