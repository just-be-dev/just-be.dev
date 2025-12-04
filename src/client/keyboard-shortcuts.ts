/**
 * Simple keyboard shortcut system
 * Finds elements with data-key attributes and sets up global key bindings
 */
const keyMap = new Map();

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

function handleKeyPress(event) {
  // Don't trigger shortcuts when typing in input fields
  if (event.target.matches("input, textarea, select")) {
    return;
  }

  // Don't trigger shortcuts when meta key is pressed
  if (event.metaKey) {
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
