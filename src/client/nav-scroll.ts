/**
 * Browser-side nav-scroll style installer for the settings dialog. The host
 * keeps an optional bundle-rewrite descriptor, while this module installs the
 * semantic rules directly so the UI remains usable when the transform cannot
 * match a closure-factory artifact. Styles are idempotent and removed with the
 * registering fiber.
 */

import { NAV_SCROLL_PATCH } from '../nav-scroll-contract.ts'

export {
  NAV_SCROLL_FILE,
  NAV_SCROLL_FUNCTION,
  NAV_SCROLL_MODULE,
  NAV_SCROLL_PATCH,
  NAV_SCROLL_ROUTE,
} from '../nav-scroll-contract.ts'

/** The dialog navigation's semantic selector: ui-settings-general renders
 * a native <nav> inside the role=dialog panel (no role="navigation"). The
 * panel is fixed-height with overflow hidden, so the nav rail needs its
 * own scroll container once the crawled catalog outgrows the dialog. */
const NAV_SELECTOR = '[role="dialog"] nav'

/** One injected style element shared by all mounted plugin fibers. */
let styleElement: HTMLStyleElement | undefined
const styleOwners = new Set<symbol>()

/** The scroll rules for the settings dialog navigation. */
const NAV_SCROLL_CSS = `
${NAV_SELECTOR} {
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding-bottom: 12px;
}
`

/** Whether the shared styles are installed in the current document. */
function installed(): boolean {
  if (styleElement !== undefined && document.head.contains(styleElement)) return true
  styleElement = undefined
  styleOwners.clear()
  return false
}

/**
 * Install the settings navigation scroll styles (idempotent).
 * @returns a disposer removing the styles.
 */
export function installNavScrollStyles(): () => void {
  // Node-side suites (and any headless context) have no document; the styles
  // are a browser-only enhancement.
  if (typeof document === 'undefined') return () => {}
  if (!installed()) {
    styleElement = document.createElement('style')
    styleElement.setAttribute('data-fabric', NAV_SCROLL_PATCH)
    styleElement.textContent = NAV_SCROLL_CSS
    document.head.appendChild(styleElement)
  }
  const owner = Symbol('nav-scroll-owner')
  styleOwners.add(owner)
  const element = styleElement
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    styleOwners.delete(owner)
    if (styleOwners.size === 0 && styleElement === element && element !== undefined) {
      element.remove()
      styleElement = undefined
    }
  }
}
