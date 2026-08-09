# `@deepseek-ai/dsh-ex-setting`

English | [中文](README.zh.md)

The automatic DSH Web settings bundle. It combines the host-side configuration crawler with its browser settings navigation in one external package: the host enumerates registered settings namespaces and schema-bearing composition rows, while the client projects them into first-level settings sections and editors.

## Repository shape

```text
package.json              # host/client package and dsh.bundle/dshClient manifests
cordis.patch.yml          # profile layer that mounts the crawler
src/index.ts              # host crawler plugin
src/client/               # browser settings page
src/invariant.ts          # crawler invariant companion
lib/                      # generated host/client artifacts
legacy/                   # source-compatible host integration patch for older DSH snapshots
docs/                     # detailed host and client protocol references
tests/host/                # crawler and composition tests
tests/client/              # browser store and section tests
```

The two runtime faces share one package identity so Git/profile installation has one root artifact. The browser face is exported as `@deepseek-ai/dsh-ex-setting/client` and is selected by the package's `dshClient` manifest.

## Bundle behavior

Installing the bundle adds the `web-config-crawler` row. That is the deployment-level decision to expose all registered settings namespaces and schema-carrying composition rows through the Web configuration plane. A profile can disable it:

```yaml
- id: web-config-crawler
  disabled: true
```

The crawler redacts secrets, applies path-addressed edits with schema resolution, persists complete rows into the personal overlay, and removes rows to restore lower bundle layers. The browser page keeps settings namespaces and composition rows source-distinct and renders schema fields, secret controls, reset, revision conflicts, restart notices, and live invalidation refreshes.

The bundle patch only composes this package. The settings/composition wire protocol, API proxy handlers, slot host, and browser shell must be supplied by the DSH version selected by the profile. The old host integration diff is retained in `legacy/` for older DSH snapshots and is not part of the new bundle contract.

## Development

A full typecheck expects sibling checkouts:

```text
~/git/deepseek-harness
~/git/ex-setting
```

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

The `prepare` script builds both host and browser entries directly from `src/`, so Git installation does not require sibling project references. pnpm 10 may require the profile to allow the package's prepare script; only approve a pinned, trusted checkout.

## Model Experience

This bundle adds no model-visible prompt text or tools. It exposes configuration only through the loopback Web settings surface; the owning DSH settings, composition, session, and permission services retain logging, redaction, and authorization semantics.

## Known Limitations and Deferred Work

- Native Zod composition Config schemas remain file-configurable but are not rendered by the generic editor, which requires schemastery `toJSON()`.
- The crawler is intentionally broad; deployments that do not want automatic composition editing should disable the row and keep the gateway allowlist posture.
- Older DSH snapshots require the host integration patch in `legacy/` because a bundle cannot add missing wire or API source seams; the current `master` also predates the `composition` client face, so full typecheck requires the compatible web-config host change (for example `a9c30fa4`).
