# `@deepseek-ai/dsh-ex-setting`

English | [中文](README.zh.md)

The automatic DSH Web settings bundle. It combines the host-side configuration crawler with its browser settings navigation in one external package: the host enumerates registered settings namespaces and schema-bearing composition rows, while the client projects them into first-level settings sections and editors.

## Repository shape

```text
package.json              # host/client package and dsh.bundle/dsh.client manifests
cordis.patch.yml          # profile layer that mounts the crawler
src/index.ts              # host crawler plugin (service provide)
src/routes.ts             # crawler-owned webserver composition route
src/composition-contract.ts # host/client composition wire types
src/composition-ops.ts     # host-side path edit application
src/client/               # browser settings page (store, section, crawler wire, nav scroll)
src/invariant.ts          # crawler invariant companion
lib/                      # generated host/client artifacts
docs/                     # detailed host and client protocol references
tests/host/               # crawler, route, export, invariant, and loader tests
tests/client/             # browser store, section, and wire tests
tests/client-bundles/     # reusable closure-bundle test seeds
tests/module-loader.ts    # module-table materialization harness
scripts/                  # declaration assembly and built bundle contract checks
.agents/skills/           # dsh-plugin-* contributor workflow
```

The two runtime faces share one package identity so the release/profile installation has one root artifact. The browser face is exported as `@deepseek-ai/dsh-ex-setting/client` and is selected by the package's `dsh.client` manifest. Its pure schema-form path helpers are inlined into the browser closure instead of requiring a separate dynamic `@deepseek-ai/dsh-client-schema-form` row, which keeps the release compatible with profiles whose settings UI owns the schema service. The package's own declaration pass writes to `lib/.client-dts` and removes it before packing; only `lib/client.js` is served to the browser.

The consuming profile supplies the DSH host peers; this bundle has no Stent runtime or host bundle-rewrite
dependency. The browser client installs its navigation fallback directly, while `cordis.patch.yml`
remains the DSH bundle layer that mounts the crawler row.

## Bundle behavior

Installing the bundle adds the `web-config-crawler` row. That is the deployment-level decision to mount the crawler, expose schema-carrying composition rows, and enable the composition editor through the Web configuration plane. The host gateway serves registered settings namespaces independently. A profile can disable the crawler row:

```yaml
- id: web-config-crawler
  disabled: true
```

The crawler redacts secrets, applies path-addressed edits with schema resolution, persists complete rows into the personal overlay, and removes rows to restore lower bundle layers. The browser page keeps settings namespaces and composition rows source-distinct and renders schema fields, secret controls, reset, revision conflicts, restart notices, and live invalidation refreshes.

## External zero-change design

This bundle ships with **zero out-of-package host changes**. Three mechanisms make that possible:

- **Host-served settings namespaces** — the DSH gateway serves every namespace registered by the active composition. Mounting this bundle adds the crawler and composition editor; it does not transform or replace the gateway's exposure decision.
- **Crawler-owned composition route** — the browser half reads and edits composition rows through the crawler's own webserver route (`/dsh-config/crawler/composition`, `src/routes.ts`) instead of a gateway RPC domain, so the write path adds nothing to `apiproxy` or `connection`.
- **Browser-owned navigation fallback** — the browser half installs the semantic scroll rules directly as a fiber-owned effect, so the settings dialog remains usable without a host bundle transform. The style is idempotent and removed on plugin disposal.

The settings/composition wire protocol, API proxy handlers, slot host, and browser shell are supplied by the DSH version selected by the profile.

## Development

The host packages (`@deepseek-ai/dsh-*`, `@deepseek-ai/cordis`) install from the npm registry: every runtime import declares them as peer + dev dependencies at the `^0.1.0-rc.0` series, and development imports resolve from this repository's own `node_modules` — no sibling checkout is required. The devDependencies also enumerate the peer closure of the test-only host tree (the apiproxy composition test imports the real gateway).

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
pnpm pack --dry-run --json
```

The release artifact is built from `src/` before packing. The declaration pass writes to a temporary ignored directory, `scripts/assemble-client-dts.mjs` promotes only the public client declarations, and the final runtime pass alone writes `lib/client.js`; `scripts/verify-client-bundle.mjs` rejects plain ESM, dynamic imports, and unexpected module-table requests. Profile installation consumes ready-made `lib/` output and does not run an install-time `prepare` hook.

## CI

The repository has one GitHub Actions workflow:

- `.github/workflows/release.yml` — every push to `main`: installs from the frozen lockfile, runs typechecking, tests, the build (including the final client artifact gate), packs the ready-made tarball and checksum, and creates a new GitHub Release tagged `v<version>` when `package.json` changed. Non-version pushes only validate the package; an existing tag fails rather than being overwritten.

## Model Experience

This bundle adds no model-visible prompt text or tools. It exposes configuration only through the loopback Web settings surface; the owning DSH settings, composition, session, and permission services retain logging, redaction, and authorization semantics.

## Known Limitations and Deferred Work

- Native Zod composition Config schemas remain file-configurable but are not rendered by the generic editor, which requires schemastery `toJSON()`.
- The crawler is intentionally broad; deployments that do not want automatic composition editing should disable the row and keep the gateway allowlist posture.
