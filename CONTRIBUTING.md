# Contributing to Branchwork

Thanks for your interest. The project is pre-1.0 and moving quickly; this file covers the
mechanics. Product direction lives in `docs/product/concept.md`, decisions in
`docs/decisions/`.

## Development

```bash
npm install
npm run dev        # apps/web on http://localhost:3210
npm test           # vitest in all packages
npm run typecheck  # tsc --noEmit in all packages
```

No API keys are needed; the mock model provider works offline (ADR-0004).

## Ground rules

- **Provenance is not optional.** Anything generated must record its run
  (`authorKind`, `modelRunId`) and stream through a provisional node.
- **The graph is semantic.** New behaviour should use node/edge types, not spatial
  position or ad-hoc flags. Register new types in the domain registries rather than
  hard-coding.
- **Canvas state is a projection.** React Flow arrays derive from domain records; never
  store application truth on RF nodes.
- **Schema changes** go through Zod in `packages/domain` with a bumped export
  `formatVersion` and a migration note in an ADR.
- Tests accompany behavioural changes: traversal/collapse/context rules have unit tests;
  keep them green.

## Commit style

Short imperative subjects (`Add branch collapse badge`, `Fix dagre scope for selection`).
One logical change per commit.

## Licence

Not yet chosen — see concept document §21. Contributions cannot be accepted until a
licence lands.
