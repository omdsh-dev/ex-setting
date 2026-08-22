# ex-setting Contributor Notes

This repository is the standalone DSH Web settings bundle: one package
(`@deepseek-ai/dsh-ex-setting`) with a host crawler half (`src/index.ts`,
`src/routes.ts`, `src/invariant.ts`) and a browser client half (`src/client/`). It is an external bundle installed through the
official plugin channel (`dsh plugin --profile web add
https://github.com/omdsh-dev/ex-setting/releases/latest/download/pkg.tgz`).

- Preserve the function-plugin named exports: `name`, `inject`, `Config`, and `apply`; do not add a default export.
- Keep the crawler's Loader metadata in `src/index.ts`; the composition write path in `src/routes.ts`; the browser nav-scroll fallback in `src/client/nav-scroll.ts`; invariant companions in `src/invariant.ts` and `src/client/invariant.ts`.
- Keep all registrations scoped to the plugin fiber and test disposal.
- Host-provided runtime APIs (`@deepseek-ai/dsh-*`, `@deepseek-ai/cordis`) install from the npm registry: declare them as peer + dev dependencies at the `^0.1.0-rc.0` series and import them by package name — never pin a sibling-checkout path in code or configs. The devDependencies also enumerate the peer closure of the test-only host tree.
- The crawler has no Stent runtime or host bundle-rewrite dependency. Its browser client installs the nav-scroll fallback directly; keep the DSH bundle descriptor only for mounting the crawler row. This repository's `pnpm-workspace.yaml` enables `strictPeerDependencies` for local installs and checks.
- Describe repository files with project-root paths such as `docs/web-config-crawler.md`; never use parent-directory navigation in documentation.
- Update `README.md`, configuration JSDoc, tests, and `cordis.patch.yml` together when behavior changes.
- Keep the repository-local `.agents/skills/dsh-plugin-*` workflow synchronized with repository paths, commands, and package conventions.
- Run `pnpm run typecheck`, `pnpm test`, `pnpm run build`, and `pnpm pack --dry-run --json` before publishing changes.
