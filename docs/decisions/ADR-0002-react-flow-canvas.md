# ADR-0002: React Flow is the canvas foundation

- Status: accepted
- Date: 2026-08-22

## Context

§6.1 of the concept document recommends React Flow (`@xyflow/react`) over general
whiteboard SDKs because Branchwork's core objects are semantic nodes and typed edges, and
the graph must remain queryable and serialisable independently of the canvas.

## Decision

Build the canvas on `@xyflow/react` v12 with a single custom node type:

- `ResearchNodeShell` owns selection styling, handles (top = target, bottom = source),
  badges, status dot, toolbar, and the in-card edit state.
- The store holds **domain records** (`ResearchNode`, `ResearchEdge`) keyed by id. The
  React Flow node/edge arrays are derived projections computed with `useMemo`; RF change
  events write positions/sizes back into the records. The node array is never the database.

Interaction rules implemented per §6.2: `nodrag` on interactive regions so text editing and
buttons never drag cards; `nowheel` around editors so scrolling inside an editor does not
zoom the canvas; double-click zoom disabled; newly created children enter edit mode with
focus; `deleteKeyCode` is null and deletion is handled at the domain level so keyboard
shortcuts can distinguish canvas focus from editor focus.

## Consequences

- tldraw remains the documented alternative if freehand annotation becomes a requirement,
  but it will not be added alongside React Flow.
- Variable card heights complicate Dagre layout; we persist measured sizes into
  `ResearchNode.size` so layout uses real dimensions.
