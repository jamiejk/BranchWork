# Branchwork

An open-source spatial writing and research environment.

> **Nonlinear thinking upstream; linear writing downstream; provenance preserved throughout.**

The primary workspace is an infinite canvas of typed, connected cards — questions, notes,
claims, sources, excerpts, counterarguments. The same research graph feeds conventional
manuscripts whose paragraphs and citations keep backlinks to the exact nodes and excerpts
that informed them. Model use is visible, scoped, and attributable: every generation shows
its context manifest and records its run.

## Status

Early prototype (`0.1.0`). Current vertical slice:

### Canvas
- Typed cards on an infinite canvas ([React Flow](https://reactflow.dev)): questions, notes,
  claims, counterclaims, evidence, excerpts, sources, concepts and more.
- Pan (drag anywhere on a card or canvas), wheel zoom, minimap, per-card resize handles.
- **Independent title & body editing** — click a title for an inline rename; double-click
  for the body. First capture on an untitled card still derives its title automatically.
- Markdown rendering in card bodies (`**bold**`, `*italic*`, `` `code` ``, links).
- Connections from every side (top/left in, bottom/right out); anchors persist per edge.
- Drag a connection into empty space → pick a card type → it's created *and* connected.
- Select text inside a card → right-click → **break the selection into its own card**.
- Keyboard-first branching: `Tab` child · `Shift+Enter` sibling · `Enter` edit ·
  `Delete` remove · `Ctrl+S` checkpoint · `Ctrl+Z` undo.
- Right-click the empty canvas for the full new-card menu.

### Models
- Works offline with a bundled **mock provider** (streams, no key needed).
- Bring any **OpenAI-compatible endpoint** (xAI, OpenAI, DeepSeek, Mistral, Ollama, relays):
  configure providers/models/keys in ⚙ Models — stored only in your browser.
- Per-model reasoning-effort setting; a separate **background-tasks model** for cheap
  extraction runs.
- After each exploration: cited **sources** become source nodes (`cites` edges) and key
  **entities** become concept cards (`related_to` edges) — both deduplicated.

### Saving & versions
- Named save folders live in the browser's private filesystem (OPFS): autosave writes
  `saves/<name>/project.branchwork.json` continuously; **`test`** is your scratch space.
- Optional **disk link**: mirror autosaves to a real `.json` file you own (Chromium).
- **Version history** in IndexedDB (~90s autosave snapshots + manual checkpoints),
  browse & restore from 🕘 Versions.
- Corrupt/unreadable saves are quarantined, never overwritten — a recovery screen offers
  restores from history.
- JSON export/import for off-device backups.

See [`docs/product/concept.md`](docs/product/concept.md) for the full product concept,
[`docs/decisions/`](docs/decisions/) for architecture decision records.

## Quick start

```bash
npm install
npm run dev        # picks a free port from 3210 → http://localhost:3210
npm test           # vitest across packages
npm run typecheck  # tsc --noEmit across packages
```

Requires Node 20+. No API keys required — the bundled mock provider works fully offline.

## Repository layout

```text
apps/web                        Next.js application
  src/components/canvas         Canvas board, node shell, edge, context menu, panels
  src/components                Top bar, inspector, manuscript view, settings modals
  src/state                     store (composition root), model-runs, manuscript-actions,
                                persistence (OPFS + IndexedDB + legacy migration),
                                fileProject (save folders/disk link), modelSettings,
                                source-extraction, generation helpers
packages/domain                 Zod schemas & types: nodes, edges, sources, manuscripts, runs
packages/graph                  Traversal, ancestry rules, collapse, Dagre layout, context assembly
packages/models                 Adapter interface, roles, registry, mock + OpenAI-compatible providers
docs/decisions                  Architecture decision records
docs/product                    Concept document
```

## Storage & privacy model

Local-first, no server. Project files and version history stay in your browser profile;
card content is sent only to the LLM endpoint you configure. API keys are kept in
localStorage alongside settings, used solely as Authorization headers, and never committed
to the repository. Data at rest is plaintext — safe from the network, not from local
machine access; use Export for off-device backups.

## Licence

Not yet chosen — see the licence discussion in the concept document (§21). Until a licence
is added, all rights are reserved by the authors.
