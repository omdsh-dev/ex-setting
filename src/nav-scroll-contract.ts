/**
 * Shared identifiers for the host browser-bundle rewrite and its client-side
 * fallback style installer. This module is runtime-safe in both build faces.
 */

/** Patch id claimed by the host rewrite and used as the style marker. */
export const NAV_SCROLL_PATCH = 'web-config-crawler/nav-scroll'

/** Package whose browser bundle contains the settings dialog root. */
export const NAV_SCROLL_MODULE = '@deepseek-ai/dsh-client-ui-settings-general'

/** Bundle file rewritten by the host transform. */
export const NAV_SCROLL_FILE = 'lib/client.js'

/** Component targeted by the host transform. */
export const NAV_SCROLL_FUNCTION = 'SettingsRoot'

/** Exact bundle route served by the host transform. */
export const NAV_SCROLL_ROUTE = `/plugins/${NAV_SCROLL_MODULE}/client.js`
