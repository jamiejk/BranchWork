# ADR-0006: graph conventions — edge direction, ancestry acyclicity, collapse

- Status: accepted
- Date: 2026-08-22

## Context

§5.1 permits a general graph with typed edges while requiring `branches_from` ancestry to
stay acyclic. The document does not fix edge direction; traversal and context assembly
need a convention.

## Decision

1. **Direction:** for `branches_from`, `sourceNodeId` is the parent and `targetNodeId` is
   the child — the arrow points from question to answer, matching top-to-bottom card
   layout and Dagre's TB ranking. Semantic edges (`supports`, `cites`, …) point from the
   supporting material toward the thing supported (excerpt → claim, excerpt → source).
2. **Acyclicity:** `wouldCreateAncestryCycle()` rejects any new `branches_from` edge whose
   child already reaches the parent through ancestry; self-loops are rejected; duplicates
   of an existing pair+type are rejected. Other edge types may connect freely.
3. **Multi-parent:** a node may have several ancestry parents; `buildParentMap` keeps the
   first-created one as *the* parent for breadcrumbs and sibling operations.
4. **Collapse:** collapsing a node hides all strict descendants (records are kept, never
   deleted); edges touching hidden nodes are hidden. Nested collapse is idempotent — a
   descendant set is a subset regardless. A badge on the collapsed card counts its hidden
   direct children.

## Consequences

- Ancestry context ("branch" scope) walks the single-parent map, so manifests are stable.
- Cycle prevention lives in the store action and in `packages/graph`, both covered by unit
  tests; UI connection attempts that would cycle surface a toast instead of corrupting data.
