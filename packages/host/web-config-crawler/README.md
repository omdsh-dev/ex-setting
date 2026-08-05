# @deepseek-ai/dsh-host-web-config-crawler

English | [中文](README.zh.md)

The deployment-level opt-in that makes the Web configuration surface fully automatic. While this plugin is mounted, the host API gateway serves EVERY registered settings namespace to the Web client — no per-plugin opt-in required — and exposes every mounted plugin's composition `Config` (the cordis.yml row configuration) through the `composition.*` RPC domain. A composition without it keeps the gateway's default stance: only configurable model-provider namespaces and the explicit `permission`/`ui-onboarding` allowlist are served, and any other namespace answers `settings-not-exposed`.

## Service API

- Provides `ctx.webConfigCrawler` (`namespaces(): SettingsNamespace[]`) — the live settings registry, in registration order, resolved at call time so namespaces that mount or dispose between requests are reflected immediately. The gateway consults this service whenever it computes the servable set.
- `compositionConfigs()` — every mounted plugin whose composition row carries a `Config` schema, redacted (the same structural walk the settings seam uses), in registry order.
- `updateComposition(id, ops)` — applies path-addressed ops to the plugin's CURRENT resolved configuration (so a secret the wire never returned survives), validates against the `Config` schema, and persists the full row into the personal overlay.
- `removeComposition(id)` — removes the row from the personal overlay so the next boot reverts to the lower composition layers.

## Composition writes

The personal overlay is the `$DSH_HOME/config.yaml` patch layer every surface applies over the shipped base and mode overlays (a crawler `overlayPath` config overrides the default). A row's `config` in that file replaces the row's lower-layer config wholesale, so the crawler always writes the complete resolved configuration — defaults and all — and rewrites the file through YAML round-trip, preserving unrelated rows. An emptied overlay is deleted (an absent overlay is no layer). Changes take effect on the next boot; the personal config watcher may apply some rows live, but restart is the guaranteed contract.

## Security stance

Mounting this plugin is the explicit decision to expose all user-adjustable plugin settings over the configuration plane. The plane's existing protections stay in force: every response is redacted (`role('secret')` values never ride the wire), writes carry revision conflict detection, and the browser carrier restricts the whole configuration plane to loopback same-origin requests. The invariant companion asserts the crawl covers the registry whenever both services are mounted.

## Model Experience

None, as the crawler never touches a model request.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- **Schema-renderable Config only** — composition rows whose `Config` does not expose schemastery's `toJSON()` contract remain file-only; the generic Web editor cannot rehydrate native-Zod schemas.
- **No per-namespace opt-out** — with the crawler mounted, every registered namespace is served. A future `deny` list would let a deployment pin specific namespaces back to `settings-not-exposed`.
