# ADR-0003: cards store plain text for now; rich-text editor choice is deferred

- Status: accepted
- Date: 2026-08-22

## Context

§6.4 recommends Lexical for long-form editing, subject to a comparison spike against
Tiptap covering citations, Markdown round-tripping, clipboard behaviour, and custom inline
elements (§22.9). Wiring either editor before the canvas fundamentals work would couple two
large risks.

## Decision

For `0.1.0`, card content and manuscript drafts are **plain text with light Markdown**
stored in `ResearchNode.content`. `derivePlainText()` strips Markdown for the searchable
`plainText` field. Editing happens in a plain textarea inside the card.

The domain schema keeps a `content: string` field so a later rich-text document format can
replace the string without breaking stored data (a versioned migration will accompany the
switch). The Lexical-vs-Tiptap spike remains Milestone 0 work and must be settled before
citation markers and passage provenance land in the manuscript editor (§5.6 notes the
editor dependency explicitly).

## Consequences

- No bold/italics rendering in cards yet; acceptable for capture-focused workflows.
- Manuscript drafting streams into per-section textareas rather than one long-form editor;
  the section model already matches the planned outline-driven drafting pipeline.
