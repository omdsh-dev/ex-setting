/**
 * Nav-scroll patch contract shared by the crawler host and its browser half.
 *
 * The settings navigation is a flex column owned by ui-settings-general;
 * with the crawler's long automatic catalog it must scroll instead of
 * overflowing the dialog. The host half serves the ui-settings-general client
 * bundle through the optional browser transform and keeps the target descriptor
 * here; the browser half installs the same semantic scroll styles directly as
 * a fallback that does not depend on transformed code. No hashed CSS module
 * class name leaks across packages.
 * @module @deepseek-ai/dsh-ex-setting/nav-scroll
 */

import {
  NAV_SCROLL_FILE,
  NAV_SCROLL_FUNCTION,
  NAV_SCROLL_MODULE,
  NAV_SCROLL_PATCH,
} from './nav-scroll-contract.ts'

export {
  NAV_SCROLL_FILE,
  NAV_SCROLL_FUNCTION,
  NAV_SCROLL_MODULE,
  NAV_SCROLL_PATCH,
  NAV_SCROLL_ROUTE,
} from './nav-scroll-contract.ts'

/**
 * The static patch descriptor the host uses for the optional bundle transform;
 * the browser half installs the corresponding semantic styles directly.
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
