# ADR-0005: local-first storage; versioned JSON export is the interchange format

- Status: accepted
- Date: 2026-08-22

## Context

§11 recommends PostgreSQL eventually but §16/§17 allow the first prototype to persist
locally. §21.2 requires a documented, versioned export format so users can always leave
with their work.

## Decision

- The web app autosaves the whole project bundle to `localStorage`
  (`branchwork.project.v1`) with a 500 ms debounce and flushes on unload. Viewport,
  selection, and collapse state are session-level and only viewport is persisted.
- The same bundle shape is the file format: `format: "branchwork/project"`,
  `formatVersion: 1`, validated by `branchworkExportFileSchema` (Zod) on import and before
  save. It covers project, nodes, edges, sources, excerpts, manuscripts, passage
  provenance, and model runs.
- Import replaces state only after schema validation succeeds; failures surface as toasts,
  never as partial loads.

## Consequences

- PostgreSQL + Drizzle (Milestone 5) will map directly onto this aggregate; the Zod
  schemas are the single source of truth for both.
- localStorage limits (~5 MB) cap practical project size until server storage exists;
  model-run logs may be trimmed from exports if size becomes an issue.
