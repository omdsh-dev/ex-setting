# Standalone DSH Plugin Contracts

This reference is shipped with the template so planning, implementation, testing, and distribution use only guidance stored below the repository root.

## Repository boundary

All source, TypeScript configuration, test fixtures, skill instructions, and contributor guidance used by this template live below the repository root. Describe repository files with project-root paths such as `docs/dsh-plugin-contracts.md`; parent-directory navigation is not valid documentation. Paths that leave the repository are not valid template inputs. Ordinary npm dependencies are allowed; a dependency is not a source or configuration file reference.

A DSH host is a runtime consumer of the finished package, not a development input. The host supplies Cordis services and applies the package's bundle patch when the package is installed into a profile.

## Plugin forms

A function plugin exports `name`, `inject`, `Config`, and `apply` as one ESM namespace and has no default export. A service plugin default-exports its service class and follows the host service lifecycle. Do not combine the two loader forms.

Required Cordis services belong in `inject`. Optional services are read through named lookup and must tolerate absence or attach and detach through a scoped injection. Configuration is a serializable Schemastery schema; deployment-varying choices are fields, not hidden constants.

## Scalable repository structure

This bundle is a dual-face package: the host crawler half lives at `src/index.ts` (Loader metadata, service provide, and browser bundle serving), `src/routes.ts` (the crawler's own webserver composition route), `src/nav-scroll.ts` (the browser bundle rewrite contract), and `src/invariant.ts`; the browser client half lives under `src/client/`. For a larger plugin, keep those responsibilities focused and group cohesive behavior under capability-named directories such as `src/<feature>/`. Add `src/services/` only when the package owns actual Cordis services.

The baseline test boundary separates host tests (`tests/host/`) from client tests (`tests/client/`): loader composition and unit suites live under `tests/host/`, browser store/section/wire suites under `tests/client/`, and reusable closure-bundle seeds under `tests/client-bundles/` with the module-table harness in `tests/module-loader.ts`. Add focused specs beside the behavior they cover.

The repository has no out-of-package host patch directory; `cordis.patch.yml` is the only profile-layer change and the published package contains no source patches.

## Lifecycle ownership

Every listener, registry entry, timer, watcher, child process, and callback registered by a plugin belongs to its Cordis fiber. Use effects or returned disposers and test removal after fiber disposal. Publish state and emit events only after the owning operation succeeds. A waterfall listener delegates by calling `next()`.

## Invariant companion

Every package may expose `./invariant` as a separate function plugin. Its installer checks an authoritative event or data relationship owned by the package. An empty installer is valid only when the package owns no observable relationship; explain that reason in the source. The companion can use the host's `invariants` service through the narrow local interface in `src/invariant.ts`.

## Bundle composition

`package.json` declares the bundle patch with `dsh.bundle.patch`. `cordis.patch.yml` inserts or overrides plugin rows; it does not change source files, compiler settings, catalogs, or launcher code. An id-targeted override replaces the complete `config`, so retained fields must be restated. The package row name must resolve through the consuming DSH profile.

## Evidence

The minimum package evidence includes a real Loader export-shape test, schema/default behavior, observable plugin behavior, and disposal. Product-visible behavior additionally needs a real assembled composition test and a focused keyless snapshot when output is stable and user-visible. Typechecking, tests, and a development build are separate checks.

## Build and distribution

The development verification is:

```sh
pnpm run typecheck
pnpm test
pnpm run build
pnpm pack --dry-run --json
```

The package build stages browser declarations under `lib/.client-dts`, promotes only `client.d.ts` and its map with `scripts/assemble-client-dts.mjs`, then emits the closure-factory runtime and validates it with `scripts/verify-client-bundle.mjs`. A declaration build must never write a plain ESM artifact to the published `lib/client.js` path.

The release build produces a ready-made artifact with the same commands and
`pnpm pack --dry-run --json`; it emits declarations and runtime JavaScript using
only this repository's installed dependencies. The release package declares Stent as a required host peer, not a runtime or bundled dependency, so it never carries a second Stent copy. This repository's `pnpm-workspace.yaml` enables `strictPeerDependencies` for local installation and verification. The consuming profile must install `@oh-my-dsh/stent-pack` separately; the package's workspace setting is not transferred to the profile's pnpm configuration. Profile/plugin installation consumes the packed artifact and does not run an install-time `prepare` hook. Inspect the final file list and restore a development build
afterward when the pack lifecycle cleans or replaces generated files.

A package is ready for Git or npm only when every manifest-declared runtime and type entry exists after the relevant consumer lifecycle. Publishing, pushing, tagging, and registry operations remain separately authorized actions.
