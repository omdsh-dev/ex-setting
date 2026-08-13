/**
 * Nav-scroll patch contract shared by the crawler host and its browser half.
 *
 * The settings navigation is a flex column owned by ui-settings-general;
 * with the crawler's long automatic catalog it must scroll instead of
 * overflowing the dialog. The host half rewrites the ui-settings-general
 * client bundle at request time (serveBrowserTransform) so the SettingsRoot
 * component publishes this patch id; the browser half registers a `before`
 * handler that injects the scroll styles into the document. The styles match
 * the dialog's navigation semantically, so no hashed CSS module class name
 * leaks across packages.
 * @module @deepseek-ai/dsh-ex-setting/nav-scroll
 */

/** Patch id shared with the browser half's handler registration. */
export const NAV_SCROLL_PATCH = 'web-config-crawler/nav-scroll'

/** The transformed bundle: ui-settings-general's browser artifact. */
export const NAV_SCROLL_MODULE = '@deepseek-ai/dsh-client-ui-settings-general'

/** The bundle file the transform rewrites (the client-modules artifact path). */
export const NAV_SCROLL_FILE = 'lib/client.js'

/** The component the transform targets: the settings dialog root. */
export const NAV_SCROLL_FUNCTION = 'SettingsRoot'

/** Exact route that outranks the module host's `/plugins` prefix. */
export const NAV_SCROLL_ROUTE = `/plugins/${NAV_SCROLL_MODULE}/client.js`

/**
 * The static patch descriptor the host serves the transformed bundle with.
 * The handler is bound by the browser half under the same id.
 */
export const navScrollPatch = {
  id: NAV_SCROLL_PATCH,
  target: {
    module: NAV_SCROLL_MODULE,
    versionRange: '>=0.0.1-0',
    filePath: NAV_SCROLL_FILE,
    functionQuery: { functionName: NAV_SCROLL_FUNCTION, kind: 'Sync' as const },
  },
  operation: 'before' as const,
}
