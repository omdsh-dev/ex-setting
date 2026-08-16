/**
 * Test bundle seed for the registry `@deepseek-ai/dsh-client-locale/client`
 * closure bundle: register the real bundle, materialize its factory, and
 * re-export the values the tests import. Type-only imports keep resolving
 * through the registry package's d.ts. The bundle is imported by filesystem
 * path: a bare specifier would hit this alias again.
 */
import { materialize, prepareClientBundles } from '../module-loader.ts'


await prepareClientBundles(
  ['@deepseek-ai/cordis', 'react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives'],
  ['../../node_modules/@deepseek-ai/dsh-client-locale/lib/client.js'],
)
const locale = materialize<Record<string, unknown>>('@deepseek-ai/dsh-client-locale')
export const LocaleRuntime = locale.LocaleRuntime
