/**
 * Test bundle seed for the registry `@deepseek-ai/dsh-client-runtime/client`
 * closure bundle: register the real bundle, materialize its factory, and
 * re-export the values the tests (and ex-setting's own src modules) import.
 * Type-only imports keep resolving through the registry package's d.ts.
 * The bundle is imported by filesystem path: a bare specifier would hit
 * this alias again.
 */
import { materialize, prepareClientBundles } from '../module-loader.ts'


await prepareClientBundles(
  ['@deepseek-ai/cordis', 'react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives'],
  ['../../node_modules/@deepseek-ai/dsh-client-runtime/lib/client.js'],
)
const runtime = materialize<Record<string, unknown>>('@deepseek-ai/dsh-client-runtime')
export const ConversationEventRegistry = runtime.ConversationEventRegistry
export const ConversationViewRegistry = runtime.ConversationViewRegistry
export const EMPTY_CHAT_SNAPSHOT = runtime.EMPTY_CHAT_SNAPSHOT
export const EMPTY_CONVERSATION_VIEWS = runtime.EMPTY_CONVERSATION_VIEWS
export const SessionProvideChannel = runtime.SessionProvideChannel
export const SlotRegistry = runtime.SlotRegistry
export const createScope = runtime.createScope
export const createSnapshotStore = runtime.createSnapshotStore
export const scopeOf = runtime.scopeOf
