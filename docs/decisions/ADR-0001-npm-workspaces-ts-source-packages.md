# ADR-0001: npm workspaces monorepo; workspace packages ship TypeScript source

- Status: accepted
- Date: 2026-08-22

## Context

The concept document (§18) proposes a monorepo with separable packages for domain, graph,
models, and UI. We need tooling that works today, on Node 20/22, without adding build
orchestration before the architecture is proven.

## Decision

- Use **npm workspaces** (`apps/*`, `packages/*`). pnpm is likely faster and stricter, but
  npm is preinstalled everywhere and adequate at this size; switching later is cheap
  because nothing depends on lockfile-specific features.
- Workspace packages (`@branchwork/domain`, `@branchwork/graph`, `@branchwork/models`)
  publish their **TypeScript source** as their entry point. The Next.js app compiles them
  via `transpilePackages`; Vitest consumes them natively. There are no per-package build
  outputs to keep in sync.

## Consequences

- No watch/rebuild loops between packages during development.
- Consumers outside a bundler would need their own TS pipeline; acceptable until any
  package is published to a registry, at which point we add `tsc` builds to those packages.
- Type safety across packages is enforced by running `tsc --noEmit` in each workspace via
  `npm run typecheck`.
