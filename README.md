# `@deepseek-ai/dsh-ex-setting`

English | [中文](README.zh.md)

The automatic DSH Web settings bundle. It combines the host-side configuration crawler with its browser settings navigation in one external package: the host enumerates registered settings namespaces and schema-bearing composition rows, while the client projects them into first-level settings sections and editors.

## Repository shape

```text
package.json              # host/client package and dsh.bundle/dsh.client manifests
cordis.patch.yml          # profile layer that mounts the crawler
src/index.ts              # host crawler plugin (service provide + Fabric handler binding)
src/routes.ts             # crawler-owned webserver composition route
src/nav-scroll.ts         # browser bundle rewrite contract (serveBrowserTransform)
src/invariant.ts          # crawler invariant companion
src/client/               # browser settings page (store, section, crawler wire)
lib/                      # generated host/client artifacts
docs/                     # detailed host and client protocol references
tests/host/               # crawler, route, invariant, loader, and Fabric composition tests
tests/client/             # browser store and section tests
patches/                  # host patch contract (empty: zero out-of-package changes)
scripts/                  # verify:self-contained, host patch extraction/applier
.agents/skills/           # dsh-plugin-* contributor workflow
```

The two runtime faces share one package identity so the release/profile installation has one root artifact. The browser face is exported as `@deepseek-ai/dsh-ex-setting/client` and is selected by the package's `dsh.client` manifest.

The profile must already provide the `cordis-fabric` and `cordis-fabric-api` 0.1.0 runtime pair. They are required peer dependencies of this plugin, not `dependencies` or `bundledDependencies`, so the release tarball never carries a second Fabric copy. This repository's `pnpm-workspace.yaml` enables `strictPeerDependencies`, so local installs and checks fail when either peer is unavailable. Install the Fabric release bundle in the consuming profile first; a package's workspace setting is not copied into that profile's pnpm configuration. The profile must still include that Fabric bundle because its `fabric-dsh` launcher installs the load-time hooks and bootstrap row.

## Bundle behavior

Installing the bundle adds the `web-config-crawler` row. That is the deployment-level decision to expose all registered settings namespaces and schema-carrying composition rows through the Web configuration plane. A profile can disable it:

```yaml
- id: web-config-crawler
  disabled: true
```

The crawler redacts secrets, applies path-addressed edits with schema resolution, persists complete rows into the personal overlay, and removes rows to restore lower bundle layers. The browser page keeps settings namespaces and composition rows source-distinct and renders schema fields, secret controls, reset, revision conflicts, restart notices, and live invalidation refreshes.

## External zero-change design

This bundle ships with **zero out-of-package host changes**. Three mechanisms make that possible:

- **Fabric exposure widening** — the crawler is Fabric-required: its `cordis.patch.yml` row carries the static `web-config-crawler/exposed-namespaces` stub under the row's own config and ships disabled, and the `fabric-dsh` launcher enables Fabric-required rows at launch. A plain `dsh` boot therefore skips this bundle entirely (the app runs, the crawler stays unloaded), while a fabric-dsh boot loads it with the hooks installed and the gateway's private `exposedNamespaces()` decision rewritten at load time; the crawler binds the matching `after` handler when it mounts, and the `required` stub makes a boot where the transform bound nothing fail loud (see `docs/web-config-crawler.md`).
- **Crawler-owned composition route** — the browser half reads and edits composition rows through the crawler's own webserver route (`/dsh-config/crawler/composition`, `src/routes.ts`) instead of a gateway RPC domain, so the write path adds nothing to `apiproxy` or `connection`.
- **Served browser rewrite** — the crawler serves the `ui-settings-general` client bundle through `serveBrowserTransform`, rewriting `SettingsRoot` to publish `web-config-crawler/nav-scroll`; the browser half registers the matching `before` handler that injects the dialog navigation scroll styles (see `docs/ui-settings-plugins.md`).

The settings/composition wire protocol, API proxy handlers, slot host, and browser shell are supplied by the DSH version selected by the profile.

## Development

The host packages (`@deepseek-ai/dsh-*`, `@deepseek-ai/cordis`) install from the npm registry: every runtime import declares them as peer + dev dependencies at the `^0.1.0-rc.0` series, and development imports resolve from this repository's own `node_modules` — no sibling checkout is required. The required Fabric peers are also present as pinned GitHub Release tarballs in `devDependencies` for local typechecking and tests; they are not included in the release package. The devDependencies also enumerate the peer closure of the test-only host tree (the apiproxy composition test imports the real gateway).

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
pnpm run verify:self-contained
```

The release artifact is built from `src/` before packing, so profile installation consumes ready-made `lib/` output and does not run an install-time `prepare` hook. A checkout is developed with the commands above and then packaged for the plugin channel.

## CI

Two GitHub Actions workflows ship with the repository:

- `.github/workflows/ci.yml` — every push to `main` and every pull request: frozen-lockfile install, `verify:self-contained`, typecheck, tests, and build.
- `.github/workflows/release.yml` — every push to `main`: verifies, typechecks, tests, builds, packs the ready-made tarball (`pnpm pack`), and publishes it to a GitHub Release tagged `v<version>` from `package.json`. Bump `version` to cut a new release; re-pushing the same version refreshes that release's artifact.

## Model Experience

This bundle adds no model-visible prompt text or tools. It exposes configuration only through the loopback Web settings surface; the owning DSH settings, composition, session, and permission services retain logging, redaction, and authorization semantics.

## Known Limitations and Deferred Work

- Native Zod composition Config schemas remain file-configurable but are not rendered by the generic editor, which requires schemastery `toJSON()`.
- The crawler is intentionally broad; deployments that do not want automatic composition editing should disable the row and keep the gateway allowlist posture.
