/**
 * Client behavior for the site header (`src/components/Nav.astro`).
 *
 * When the header comes from the shared fragment it is rendered without knowing
 * the page, so the active tab is marked here from the browser's location.
 */
import { SITE_HEADER_TAG, isActive, isCurrent } from "@/utils/nav";

function navLinks(header: Element) {
  return Array.from(header.shadowRoot?.querySelectorAll<HTMLAnchorElement>(".nav-link") ?? []);
}

function markActiveTabs(header: Element) {
  const path = window.location.pathname;
  for (const link of navLinks(header)) {
    const href = link.getAttribute("href") ?? "";
    const current = isCurrent(href, path);
    link.classList.toggle("active", isActive(href, path));
    link.classList.toggle("current", current);
    if (current) link.tabIndex = -1;
    else link.removeAttribute("tabindex");
  }
}

for (const header of document.querySelectorAll(SITE_HEADER_TAG)) {
  if (header.hasAttribute("data-resolve-active")) markActiveTabs(header);

  // Scroll active tabs into view on page load (both top and bottom nav).
  for (const link of navLinks(header)) {
    if (link.classList.contains("active")) {
      link.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }
}
