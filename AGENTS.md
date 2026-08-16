# ex-setting Contributor Notes

This repository is the standalone DSH Web settings bundle: one package
(`@deepseek-ai/dsh-ex-setting`) with a host crawler half (`src/index.ts`,
`src/routes.ts`, `src/nav-scroll.ts`, `src/invariant.ts`) and a browser
client half (`src/client/`). It is an external bundle installed through the
official plugin channel (`dsh plugin --profile web add
github:dsh-external/ex-setting`).

- Preserve the function-plugin named exports: `name`, `inject`, `Config`, and `apply`; do not add a default export.
- Keep the crawler's Loader metadata in `src/index.ts`; the composition write path in `src/routes.ts`; the browser bundle rewrite and nav-scroll contract in `src/nav-scroll.ts`; invariant companions in `src/invariant.ts` and `src/client/invariant.ts`.
- Keep all registrations scoped to the plugin fiber and test disposal.
- Host-provided runtime APIs (`@deepseek-ai/dsh-*`, `@deepseek-ai/cordis`) install from the npm registry: declare them as peer + dev dependencies at the `^0.1.0-rc.0` series (the fabric trio's convention) and import them by package name — never pin a sibling-checkout path in code or configs. The devDependencies also enumerate the peer closure of the test-only host tree.
- The Fabric trio (`cordis-fabric`, `cordis-fabric-api`) arrives through git subdirectory specs in `dependencies`; the crawler's exposure widening and nav-scroll injection ride the Fabric layer (see `docs/web-config-crawler.md`).
- Describe repository files with project-root paths such as `docs/web-config-crawler.md`; never use parent-directory navigation in documentation.
- Update `README.md`, configuration JSDoc, tests, and `cordis.patch.yml` together when behavior changes.
- Keep the repository-local `.agents/skills/dsh-plugin-*` workflow synchronized with repository paths, commands, and package conventions.
- Run `pnpm run verify:self-contained`, `pnpm run typecheck`, `pnpm test`, `pnpm run build`, and `pnpm run prepare` before publishing changes.
