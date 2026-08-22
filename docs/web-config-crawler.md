# @deepseek-ai/dsh-ex-setting — web-config-crawler

English | [中文](web-config-crawler.zh.md)

The deployment-level opt-in that mounts the Web configuration crawler and composition editor. The host API gateway serves every registered settings namespace to the Web client — no per-plugin opt-in required — while this plugin exposes every mounted plugin's composition `Config` (the cordis.yml row configuration) through its own webserver route. Without this plugin, the gateway still serves registered settings namespaces, but the crawler and composition editor are not mounted.

## External zero-change design

The crawler adds its behavior with **zero out-of-package host changes**:

- **Host-served settings namespaces.** The DSH gateway owns the exposure decision and serves every namespace registered by the active composition. The crawler's `namespaces()` face is used by its own routes and invariant, not as a gateway patch.
- **Composition writes own a webserver route.** The browser half reads and edits composition rows through the crawler's exact route `GET/POST /dsh-config/crawler/composition` (`src/routes.ts`) instead of a gateway RPC domain, so `apiproxy` and `connection` stay untouched. The route mounts only when the webserver capability is present; non-web compositions skip it.
- **Browser-owned navigation fallback.** The browser half installs the semantic navigation rules directly as a
  fiber-owned effect, so the settings dialog does not depend on a host bundle transform.

## Service API
- `ctx.webConfigCrawler` (`namespaces(): SettingsNamespace[]`) — the live settings registry, in registration order, resolved at call time so namespaces that mount or dispose between requests are reflected immediately. The crawler uses this face for its own composition route and invariant.
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
