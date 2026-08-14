/**
 * Browser-side nav-scroll handler for the settings dialog. The host rewrites
 * the ui-settings-general client bundle so SettingsRoot publishes
 * `web-config-crawler/nav-scroll`; this module registers the matching
 * `before` handler that injects the scroll styles for the dialog navigation
 * (semantic selectors — no hashed CSS module class crosses packages). The
 * styles are idempotent and removed with the registering fiber.
 */

/** Patch id shared with the crawler host's served bundle rewrite. */
export const NAV_SCROLL_PATCH = 'web-config-crawler/nav-scroll'

/** The transformed bundle's owning package (mirrors the host descriptor). */
export const NAV_SCROLL_MODULE = '@deepseek-ai/dsh-client-ui-settings-general'

/** The bundle file the host rewrites (mirrors the host descriptor). */
export const NAV_SCROLL_FILE = 'lib/client.js'

/** The component the host transforms (mirrors the host descriptor). */
export const NAV_SCROLL_FUNCTION = 'SettingsRoot'

/** The dialog navigation's semantic selector (the settings dialog's nav list). */
const NAV_SELECTOR = '[role="dialog"] [role="navigation"]'

/** One injected style element (a singleton per document). */
let styleElement: HTMLStyleElement | undefined

/** The scroll rules for the settings dialog navigation. */
const NAV_SCROLL_CSS = `
${NAV_SELECTOR} {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding-bottom: 12px;
}
`

/** Whether the styles are currently installed. */
function installed(): boolean {
  return styleElement !== undefined && document.head.contains(styleElement)
}

/**
 * Install the settings navigation scroll styles (idempotent).
 * @returns a disposer removing the styles.
 */
export function installNavScrollStyles(): () => void {
  // Node-side suites (and any headless context) have no document; the styles
  // are a browser-only enhancement.
  if (typeof document === 'undefined' || installed()) return () => {}
  styleElement = document.createElement('style')
  styleElement.setAttribute('data-fabric', NAV_SCROLL_PATCH)
  styleElement.textContent = NAV_SCROLL_CSS
  document.head.appendChild(styleElement)
  const element = styleElement
  return () => {
    if (styleElement === element) styleElement = undefined
    document.head.removeChild(element)
  }
}
