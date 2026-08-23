# Branchwork

## An open-source spatial writing and research environment

> **Working title:** Branchwork  
> **Status:** Product concept and implementation plan  
> **Purpose:** Provide enough product, interaction, architecture, and delivery detail for contributors to prototype and build the project.

## 1. Summary

Branchwork is an open-source writing and research environment for thinking nonlinearly and publishing linearly.

The primary workspace is an infinite canvas containing connected cards. A card can hold a question, an original note, an AI exploration, a source, a quotation, a claim, a counterargument, an example, a section idea, or a draft passage. Users can branch from any card, follow several lines of inquiry in parallel, connect previously separate ideas, and retain the spatial structure of their thinking.

The same research graph can then feed one or more conventional manuscripts. Users select useful material, turn it into an outline, order the sections, and draft an essay section by section. Paragraphs and citations retain backlinks to the research nodes and exact source excerpts that informed them.

The project should support multiple model providers through an adapter layer. A user might use a fast inexpensive model for summarisation, another for source analysis, a high-reasoning model for outlining, and a preferred prose model for drafting. Direct provider APIs, routing services, and OpenAI-compatible local endpoints should all be possible without changing the canvas or manuscript data models.

The central proposition is:

> **Nonlinear thinking upstream; linear writing downstream; provenance preserved throughout.**

## 2. Why this should exist

Conventional AI chat has several limitations for serious research and writing:

- It forces branching thought into a single chronological transcript.
- Following one tangent pushes earlier questions out of sight.
- Alternative arguments and competing drafts become difficult to compare.
- Context is normally implicit and hard to control.
- Sources, claims, model outputs, and the writer's own ideas become mixed together.
- Turning a useful conversation into an essay often means copying fragments into another application and losing their relationships.

Mind-map and whiteboard products solve the spatial problem but usually treat every item as a generic shape. Conventional writing applications provide a strong linear manuscript but do not preserve the branching research process that produced it.

Branchwork joins these modes without treating either as secondary:

1. **Canvas:** explore, question, collect, compare, connect, and challenge.
2. **Manuscript:** select, outline, compose, cite, revise, and export.

The manuscript is not a flattened copy of the canvas. It is a separate document whose sections and passages can reference nodes in the graph. A single canvas may therefore support a short article, a long essay, a lecture, a proposal, and a later revised argument without duplicating the underlying research.

## 3. Product principles

### 3.1 The user remains the author

AI actions should be visible, scoped, reversible, and attributable. The interface should favour actions such as **Explore from here**, **Challenge this claim**, and **Draft this section from these notes**, rather than an opaque button that claims to write the whole essay.

### 3.2 The graph is meaningful, not merely decorative

Cards have types. Connections have types. A quotation is distinct from a claim; a source is distinct from an AI answer; `supports` is distinct from `contradicts`. This structure makes reliable context assembly, citation checking, filtering, and essay construction possible.

### 3.3 Spatial position and semantic structure are separate

Where a card appears is useful personal information, but position must not be the only representation of meaning. Semantic relationships belong in typed edges and ordered manuscript references. Users should be able to rearrange the canvas freely without changing the argument.

### 3.4 Research and manuscript remain linked but independently editable

Creating an outline must not destroy or rewrite the canvas. Editing prose must not silently alter source notes. A manuscript passage may cite or derive from several graph nodes, and a graph node may contribute to several manuscripts.

### 3.5 Provenance is a product feature

Every generated node should record which model produced it, what context it saw, what sources it received, and how it was subsequently edited. Every source-backed assertion should be traceable to a captured excerpt, page, or text range.

### 3.6 Model choice is infrastructure, not identity

No provider should be built into the conceptual model. Models are replaceable services assigned to roles or selected per action.

### 3.7 Useful before it is autonomous

The first version should make a human researcher dramatically better organised. Autonomous research agents, collaborative cursors, plugin marketplaces, and elaborate media generation can come later.

## 4. Core user experience

### 4.1 Starting a canvas

A user creates a project and enters an initial question, proposition, or working title. This creates the root node. From it they can:

- Write their own child note.
- Ask a selected model to explore the question.
- Request possible subquestions.
- Add a URL, PDF, pasted text, image, or bibliographic reference.
- Create claims, objections, examples, or section ideas manually.

New branches are placed automatically with enough room for their cards, but anything may be repositioned manually.

### 4.2 Branching from a card

Selecting a card exposes a compact action bar:

- **Add note**
- **Ask from here**
- **Suggest branches**
- **Find evidence**
- **Challenge**
- **Compare with…**
- **Summarise branch**
- **Add to outline**
- **Change type**
- **More…**

The user should be able to start a new card using a keyboard shortcut and type immediately. Branch creation must feel closer to writing in an outliner than configuring a diagram.

### 4.3 Context preview

Before an AI request is sent, Branchwork shows the context scope in a compact, editable form:

> This node + 3 ancestors + 2 pinned sources · approximately 8,400 tokens

The user can inspect, add, or remove context. Presets might include:

- **Local:** selected node only.
- **Branch:** selected node and its ancestor path.
- **Evidence:** branch plus connected source excerpts.
- **Selection:** only the currently selected nodes.
- **Project retrieval:** relevant material retrieved across the canvas.
- **Custom:** manually pinned nodes and sources.

The application should never silently send the entire project merely because it fits in a model's context window.

### 4.4 Reading and editing cards

Cards normally render lightweight content for performance and clean navigation. A card displays:

- Type and authorship indicator.
- Short title.
- Content preview.
- Source/citation count where relevant.
- Model badge for generated material.
- Status such as `draft`, `verified`, `disputed`, or `excluded`.
- Connection handles and branch controls.

Double-clicking or pressing Enter opens a full editor, either expanded in place or in a persistent inspector panel. The first implementation should test both patterns. The inspector is likely to work better for long notes because it avoids fighting canvas drag, pan, selection, and zoom gestures.

### 4.5 Navigating large canvases

Required navigation features include:

- Pan and zoom.
- Minimap.
- Search by text, type, status, model, source, or tag.
- Focus on selection.
- Collapse/expand descendants.
- Collapse a group into a summary card.
- Breadcrumb path to the root.
- Back/forward viewport history.
- Named views or saved camera positions.
- Automatic layout of selected nodes or a branch.
- Filters that hide generated explorations, sources, or excluded material.

### 4.6 From canvas to outline

The user selects nodes individually or with a lasso and chooses **Create outline from selection**. Branchwork then:

1. Identifies candidate claims, evidence, objections, examples, and contextual notes.
2. Proposes section headings and an order.
3. Places node references beneath each section.
4. Flags uncited claims and duplicated material.
5. Leaves every decision editable.

The outline should support drag-and-drop ordering. A node may appear in more than one prospective section, but the interface should warn about repeated use.

### 4.7 Drafting the manuscript

Drafting is normally performed section by section:

1. The user chooses the section and its referenced research nodes.
2. Branchwork displays the exact context and sources that will be used.
3. The user selects a model, role preset, length, tone, and citation style.
4. The section streams into the manuscript editor.
5. Paragraphs receive provenance links to relevant graph nodes.
6. Citation markers are resolved against source excerpts.
7. The user accepts, edits, regenerates, or compares variants.

Later passes can improve transitions, identify repetition, check whether objections have been answered, and compare the finished manuscript with the outline. These passes should propose edits rather than silently rewriting the complete document.

### 4.8 Returning from manuscript to canvas

The relationship should work in both directions. From a manuscript passage, the user should be able to:

- Reveal supporting nodes on the canvas.
- Create a research question from a weak passage.
- Send an unsupported claim back to the canvas for evidence gathering.
- Create a counterargument branch.
- Promote an original manuscript sentence into a reusable claim node.

## 5. Domain model

### 5.1 The canvas is a directed graph

The structure is a graph rather than a strict tree. Most exploratory branches have parent-child relationships, but sources and claims may connect across branches. The graph should permit cycles for general semantic links, although ancestry edges used for branch context should remain acyclic.

### 5.2 Initial node types

| Node type | Purpose |
| --- | --- |
| `question` | A research question or follow-up question |
| `note` | Original user-authored thinking |
| `exploration` | An AI-generated explanation or investigation |
| `source` | A URL, document, book, paper, interview, or media item |
| `excerpt` | An exact quotation or bounded passage from a source |
| `claim` | A proposition intended to be argued or assessed |
| `counterclaim` | An objection, alternative account, or opposing proposition |
| `evidence` | An observation or finding offered in support of a claim |
| `example` | A concrete illustration or case |
| `concept` | A definition or reusable concept |
| `summary` | A human- or model-produced summary of a branch or group |
| `section_idea` | A possible part of a manuscript outline |
| `draft_fragment` | Prose that might be reused in a manuscript |
| `task` | An unresolved research or editorial action |

This set should be extensible. A type registry is preferable to hard-coding behaviour throughout the UI.

### 5.3 Initial edge types

| Edge type | Meaning |
| --- | --- |
| `branches_from` | An exploratory child/ancestor relationship |
| `supports` | Source, excerpt, evidence, or reasoning supports a claim |
| `contradicts` | One node conflicts with another |
| `qualifies` | Adds limitations or conditions |
| `defines` | Defines a term or concept |
| `exemplifies` | Provides an example of a concept or claim |
| `derived_from` | A summary, claim, or draft was produced from another node |
| `cites` | Connects a statement to a source or excerpt |
| `compares_with` | Marks an explicit comparison |
| `related_to` | A deliberately weak general relationship |
| `included_in` | Associates research material with an outline section |

Typed edges can be represented visually through subtle colour, line style, icons, or labels. The default canvas must remain calm enough for long writing sessions; semantic styling should not turn it into a brightly coloured systems diagram.

### 5.4 Suggested records

```ts
type NodeId = string;
type EdgeId = string;

interface ResearchNode {
  id: NodeId;
  projectId: string;
  type: NodeType;
  title: string;
  content: RichTextDocument;
  plainText: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  status: 'draft' | 'reviewed' | 'verified' | 'disputed' | 'excluded';
  authorKind: 'human' | 'model' | 'import';
  authorId?: string;
  modelRunId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface ResearchEdge {
  id: EdgeId;
  projectId: string;
  sourceNodeId: NodeId;
  targetNodeId: NodeId;
  type: EdgeType;
  label?: string;
  createdBy: 'human' | 'model' | 'system';
  createdAt: string;
}
```

The `plainText` field is a searchable and embeddable projection of the authoritative rich-text content. Canvas position is stored with the node for convenience, but may later move into a per-view table if multiple layouts are supported.

### 5.5 Sources and excerpts

Sources require more structure than ordinary cards:

```ts
interface SourceRecord {
  id: string;
  projectId: string;
  kind: 'web' | 'pdf' | 'book' | 'paper' | 'audio' | 'video' | 'other';
  title: string;
  authors: string[];
  url?: string;
  publisher?: string;
  publishedAt?: string;
  retrievedAt?: string;
  fileObjectKey?: string;
  canonicalText?: string;
  checksum?: string;
  metadata: Record<string, unknown>;
}

interface SourceExcerpt {
  id: string;
  sourceId: string;
  nodeId?: NodeId;
  quote: string;
  prefix?: string;
  suffix?: string;
  pageNumber?: number;
  startOffset?: number;
  endOffset?: number;
  locator?: string;
  annotation?: string;
}
```

Exact excerpts should be immutable snapshots. If a web page changes, the application can record a new source capture rather than silently changing evidence previously used in a manuscript.

### 5.6 Manuscripts

```ts
interface Manuscript {
  id: string;
  projectId: string;
  title: string;
  content: RichTextDocument;
  outline: OutlineSection[];
  citationStyle: string;
  createdAt: string;
  updatedAt: string;
}

interface OutlineSection {
  id: string;
  heading: string;
  order: number;
  purpose?: string;
  nodeRefs: NodeId[];
  children: OutlineSection[];
}

interface PassageProvenance {
  manuscriptId: string;
  passageId: string;
  nodeIds: NodeId[];
  excerptIds: string[];
  modelRunId?: string;
}
```

The precise relationship between rich-text elements and `passageId` depends on the editor framework. A custom paragraph or citation node can hold stable provenance metadata.

### 5.7 Model runs

Every generated result should be reproducible enough to inspect:

```ts
interface ModelRun {
  id: string;
  projectId: string;
  providerId: string;
  modelId: string;
  role: ModelRole;
  promptTemplateId?: string;
  systemInstructions: string;
  userPrompt: string;
  contextNodeIds: NodeId[];
  sourceExcerptIds: string[];
  parameters: Record<string, unknown>;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  status: 'queued' | 'streaming' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  error?: string;
}
```

Human edits should not be lost. Generated content can retain its run ID while the node also records revisions or a `humanEditedAt` value.

## 6. Recommended React architecture

### 6.1 Canvas: React Flow

[React Flow](https://reactflow.dev/) is the recommended canvas foundation. It is MIT-licensed and already provides the difficult low-level interactions: viewport transforms, panning, zooming, selection, dragging, edges, connection handles, minimaps, resizing, keyboard accessibility, and custom React nodes. Its maintainers publish both a [mind-map tutorial](https://reactflow.dev/learn/tutorials/mind-map-app-with-react-flow) and guidance for [custom nodes](https://reactflow.dev/learn/customization/custom-nodes).

Why React Flow rather than a completely general whiteboard SDK:

- Branchwork's core objects are semantic nodes and edges.
- The graph must be queryable and serialisable independently of the canvas.
- Cards need application controls, editor states, and source metadata.
- Typed connections and automatic layout are central.
- Freehand drawing and arbitrary shapes are not MVP requirements.

[tldraw](https://tldraw.dev/) remains a credible alternative if the product later prioritises sketching, freeform annotation, or mixed-media whiteboarding. It should not be added to the first version alongside React Flow; maintaining two canvas metaphors would create substantial complexity.

### 6.2 Node rendering

Build a `ResearchNodeShell` and register specialised bodies by node type:

```tsx
const nodeTypes = {
  research: ResearchNodeShell,
  source: SourceNode,
  excerpt: ExcerptNode,
  group: GroupNode,
};
```

The node shell should own selection styling, handles, badges, status, toolbars, dimensions, and focus behaviour. Node bodies should be mostly presentational until explicitly activated for editing.

Important interaction rules:

- Text selection must not drag the node.
- Mouse-wheel scrolling inside an expanded card must not zoom the canvas.
- Keyboard shortcuts must distinguish canvas focus from editor focus.
- Connection handles should remain easy to acquire at different zoom levels.
- A newly created child should receive focus immediately.
- Nodes should have sensible min/max widths and collapse states.

### 6.3 Layout

Use manual placement as the authoritative layout and an automatic layout engine as an assistive command.

- Start with **Dagre** for predictable tree-like branch arrangement.
- Consider **ELK** when multiple handles, larger graphs, and edge-crossing reduction become important.
- Auto-layout only the new branch or current selection by default.
- Never unexpectedly rearrange the whole canvas after a model response arrives.
- Store a layout transaction so the action is undoable.

React Flow documents both [Dagre-based tree layout](https://reactflow.dev/examples/layout/dagre) and a more configurable [ELK integration](https://reactflow.dev/examples/layout/elkjs).

### 6.4 Rich-text editing: Lexical

[Lexical](https://lexical.dev/docs/intro) is the recommended manuscript and long-form node editor. It provides serialisable editor state, custom node types, React bindings, and an eventual route to collaboration.

Suggested custom editor elements:

- Citation marker.
- Source excerpt embed.
- Graph-node backlink.
- Claim or verification badge.
- Comment/highlight.
- AI revision boundary or suggestion.

Do not mount a complete Lexical instance in every visible canvas card. Render stored content to lightweight HTML or React elements and mount the editor only for the active card. The manuscript view can maintain one persistent editor instance.

Tiptap/ProseMirror is also viable. A short technical spike should compare clipboard behaviour, Markdown import/export, custom inline citation elements, tracked changes, and long-document performance before Lexical is made irreversible.

### 6.5 Application state

Separate server state from ephemeral interaction state:

- **Server state:** projects, nodes, edges, sources, excerpts, manuscripts, model runs.
- **Canvas UI state:** selection, viewport, temporary connection, drag state, open menus.
- **Editor UI state:** active card, current selection, unsaved composition, command palette.
- **Job state:** generation streams, cancellation, retries, ingestion progress.

React Flow can be controlled using its node/edge state helpers. For broader client state, Zustand is a natural fit because it is small and commonly used with React Flow. TanStack Query can manage server cache and mutations. Avoid making the React Flow node array the sole application database; it is a view projection of domain records.

### 6.6 Suggested frontend composition

```text
AppShell
├── ProjectSidebar
├── Workspace
│   ├── CanvasView
│   │   ├── ReactFlow
│   │   ├── NodeToolbar
│   │   ├── ContextComposer
│   │   ├── MiniMap
│   │   └── CommandPalette
│   └── ManuscriptView
│       ├── OutlinePanel
│       ├── LexicalEditor
│       └── ProvenanceInspector
├── InspectorPanel
└── ModelRunTray
```

The Canvas and Manuscript may initially be tabs. A later split view could show the canvas beside the active outline or passage.

## 7. Model-provider architecture

### 7.1 Unified model interface

The application should use a small internal interface even if an SDK supplies most integrations:

```ts
interface BranchworkModelAdapter {
  streamText(request: TextGenerationRequest): AsyncIterable<ModelEvent>;
  generateObject<T>(request: StructuredGenerationRequest<T>): Promise<T>;
  embed?(request: EmbeddingRequest): Promise<number[][]>;
  capabilities(): ModelCapabilities;
}
```

Capabilities might include:

- Streaming text.
- Structured output.
- Tool calling.
- Image/PDF input.
- Citation or grounding metadata.
- Prompt caching.
- Reasoning controls.
- Embeddings.
- Maximum context and output lengths.

The adapter should normalise requests and events but preserve provider-specific metadata in the model-run record.

### 7.2 AI SDK

The [Vercel AI SDK](https://ai-sdk.dev/docs/introduction) is a practical first implementation because it supports streaming, structured generation, multiple provider packages, a [provider registry](https://ai-sdk.dev/v5/docs/ai-sdk-core/provider-management), and [OpenAI-compatible endpoints](https://ai-sdk.dev/providers/openai-compatible-providers). It can be used with direct API keys; the project need not require a central gateway.

The internal adapter remains valuable because it:

- Prevents UI code from depending directly on one SDK.
- Gives the project a stable place for capability checks.
- Supports providers with unusual streaming or citation semantics.
- Makes server-side policy, logging, retries, and cost controls consistent.

### 7.3 Model roles

Users should be able to define named roles and assign a model to each:

| Role | Typical job |
| --- | --- |
| `quick_explore` | Fast branches, titles, tags, short summaries |
| `deep_explore` | Thorough explanation or multi-step reasoning |
| `source_analyst` | Extract claims, evidence, caveats, and quotations |
| `outline_builder` | Cluster selected nodes into an argument structure |
| `prose_drafter` | Write a section from approved research material |
| `critic` | Identify gaps, contradictions, repetition, and weak reasoning |
| `citation_checker` | Compare claims with cited excerpts |
| `copy_editor` | Improve prose without changing substantive claims |

The UI may offer a model selector on every AI action while defaulting to the role assignment. Project-level settings should override global defaults.

### 7.4 Bring-your-own-key and local models

Open-source deployment should support:

- Server-configured provider keys.
- Per-user encrypted provider credentials.
- OpenAI-compatible base URLs for local or hosted inference.
- A no-AI mode in which the canvas and manuscript remain fully useful.

API keys must never be sent to other clients or stored unencrypted. Model requests should normally originate on the server. A self-hosted desktop-oriented build might later offer direct local connections as an explicit option.

## 8. Context assembly

Context assembly is one of the project's core services, not an incidental prompt-building helper.

### 8.1 Context request

```ts
interface ContextRequest {
  focalNodeIds: NodeId[];
  mode: 'local' | 'branch' | 'evidence' | 'selection' | 'retrieval' | 'custom';
  pinnedNodeIds: NodeId[];
  excludedNodeIds: NodeId[];
  includeSources: boolean;
  tokenBudget: number;
}
```

### 8.2 Assembly rules

The service should:

1. Resolve selected/focal nodes.
2. Traverse only appropriate ancestry edges.
3. Add explicitly pinned nodes.
4. Add connected excerpts when evidence is requested.
5. Optionally retrieve related nodes using text search or embeddings.
6. Deduplicate repeated source material.
7. Prefer exact excerpts over model summaries when supporting claims.
8. Order context so instructions, user-authored framing, evidence, and prior model work remain distinguishable.
9. Estimate tokens and trim transparently according to a recorded policy.
10. Return both the formatted model context and a manifest displayed to the user.

### 8.3 Context format

Use stable identifiers in the model input:

```text
[NODE n_123 | type=claim | author=human]
World models may permit planning without executing actions in the environment.

[EXCERPT x_456 | source=s_22 | page=14]
Exact captured source text…
```

Structured identifiers make it possible for model output to refer back to material without inventing URLs or bibliographic details.

## 9. Research ingestion and citation integrity

### 9.1 Ingestion pipeline

For a URL or file:

1. Create a source record immediately.
2. Fetch or upload the original content.
3. Extract canonical text and page/section structure.
4. Calculate a checksum.
5. Store bibliographic metadata.
6. Allow the user to highlight exact excerpts.
7. Optionally ask a model to propose claims, themes, and quotations.
8. Require the user to accept proposed nodes before they become trusted research material.

The first MVP may support pasted text, ordinary web pages, and text-based PDFs. Scanned PDFs, audio/video transcription, browser automation, paywalled sources, and academic identifier resolution can be separate milestones.

### 9.2 Claim-source matrix

For each manuscript section, the application can derive a simple matrix:

| Claim | Supporting excerpts | Counterevidence | Status |
| --- | --- | --- | --- |
| Claim A | Source 1, p. 14; Source 3 | Source 2 | Reviewed |
| Claim B | None | None | Needs evidence |

This is more valuable than merely attaching a bibliography at the end. It allows the user and the critic model to identify unsupported assertions before drafting.

### 9.3 Citation generation

Models should not be asked to invent formatted citations from memory. The application should:

- Supply stable excerpt and source IDs.
- Ask the model to return those IDs alongside claims or passages.
- Validate that referenced IDs were actually present in context.
- Render footnotes or author-date citations from stored source metadata.
- Flag a citation when the quoted excerpt does not appear to support the associated claim.

Initial export styles might include footnotes, Markdown links, and a basic author-date form. Full CSL support can follow.

## 10. Essay-baking pipeline

“Bake into essay” is best understood as an inspectable sequence rather than one prompt.

### Phase 1: Selection

- Select a branch, a lassoed region, tagged nodes, or the whole project.
- Exclude tangents explicitly.
- Display included claims, sources, and unresolved tasks.

### Phase 2: Argument inventory

- Extract candidate thesis statements.
- Identify major claims and subclaims.
- Associate evidence and counterarguments.
- Flag duplication, contradictions, and missing evidence.

### Phase 3: Outline proposal

- Generate several possible structures if useful: chronological, thematic, problem/solution, dialectical, or custom.
- Return a structured outline object rather than unstructured prose.
- Keep each outline item linked to graph node IDs.

### Phase 4: Human ordering

- The user edits headings, purpose statements, and order.
- Nodes can be dragged between sections.
- Sections can be marked `do not draft yet`.

### Phase 5: Section drafting

- Draft only from the section's approved nodes and sources plus limited manuscript context.
- Record the model run.
- Require stable citation IDs in structured metadata.
- Permit alternative drafts without overwriting the accepted version.

### Phase 6: Whole-document review

- Check thesis/section alignment.
- Identify repeated claims or definitions.
- Review transitions.
- Find dangling references and unsupported factual claims.
- Compare the manuscript with unresolved counterarguments on the canvas.

### Phase 7: Editorial passes

- Structural edit.
- Evidence/citation check.
- Style and voice edit.
- Copy edit.
- Export validation.

Each pass should create suggestions or a new revision, not mutate the sole copy invisibly.

## 11. Backend and persistence

### 11.1 Recommended initial stack

- **Application:** Next.js with TypeScript.
- **Canvas:** `@xyflow/react`.
- **Editor:** Lexical, subject to a short comparison spike with Tiptap.
- **Client state:** Zustand.
- **Server cache:** TanStack Query if the application uses a separate API layer.
- **Database:** PostgreSQL.
- **Schema/query layer:** Drizzle or Prisma, selected by contributor preference.
- **Vector search:** pgvector, added only when retrieval is justified.
- **File storage:** S3-compatible object storage.
- **Model layer:** Vercel AI SDK behind Branchwork adapters.
- **Streaming:** Server-Sent Events for initial model streams.
- **Background work:** a database-backed job queue initially; a dedicated queue when necessary.
- **Validation:** Zod schemas shared between server and client.

PostgreSQL tables for nodes and edges are sufficient. A graph database is unnecessary at this stage and would complicate deployment. Recursive queries can handle branch ancestry; ordinary indexed join tables can handle typed semantic links.

### 11.2 Suggested database tables

```text
users
projects
project_members
research_nodes
research_edges
node_revisions
sources
source_captures
source_excerpts
manuscripts
manuscript_revisions
outline_sections
outline_node_refs
passage_provenance
model_providers
model_presets
model_runs
model_run_context_items
file_objects
tags
node_tags
```

The first personal/local build can omit users, memberships, and collaboration tables while keeping identifiers that make later migration possible.

### 11.3 API surface

The exact transport can be REST, tRPC, or server actions, but domain boundaries should remain clear:

```text
POST   /projects
GET    /projects/:id/graph
POST   /projects/:id/nodes
PATCH  /nodes/:id
POST   /projects/:id/edges
POST   /projects/:id/sources
POST   /sources/:id/excerpts
POST   /projects/:id/context/preview
POST   /projects/:id/generations
DELETE /generations/:id             # cancel
POST   /projects/:id/outlines
POST   /manuscripts/:id/draft-section
POST   /manuscripts/:id/review
GET    /model-providers/capabilities
```

Generation endpoints should accept an idempotency key so reconnects do not accidentally create duplicate branches.

### 11.4 Saving and undo

- Optimistically persist node movement with a short debounce.
- Save text changes frequently and retain revisions.
- Represent multi-node actions such as auto-layout or generated branch insertion as transactions.
- Implement undo/redo at the command/domain level rather than relying solely on component-local history.
- Model output should stream into a provisional node and become a normal revision when complete.
- Cancellation should preserve or discard partial output according to an explicit user setting.

## 12. Performance considerations

The first prototype will work easily with dozens of cards. A daily-use research project may contain hundreds or thousands.

Plan for:

- Render simple read-only card bodies except for the active editor.
- Avoid global re-renders on every streamed token or drag event.
- Buffer streaming text updates before committing to shared graph state.
- Fetch node bodies separately from lightweight graph metadata if projects become large.
- Collapse or summarise distant branches.
- Render only visible nodes where practical.
- Compute embeddings and layouts in workers or background jobs.
- Cache derived plain text, token counts, and search indexes.
- Test long-card dimensions with layout engines; variable-height nodes complicate automatic graph layout.

Performance tests should include at least 100, 500, and 2,000 lightweight nodes, plus several long active documents.

## 13. Accessibility and keyboard workflow

This product will succeed or fail partly on whether rapid thought can be captured without constant pointer use.

Initial shortcuts should cover:

- Create child node.
- Create sibling node.
- Edit selected node.
- Move selection among relatives.
- Multi-select.
- Connect selected nodes.
- Collapse/expand branch.
- Open command palette.
- Focus canvas/manuscript/inspector.
- Send selected node to outline.
- Start an AI action.
- Cancel generation.

React Flow includes keyboard-accessible foundations, but custom nodes, toolbars, and editors must be tested with screen readers and keyboard-only navigation. Colour must never be the sole indicator of node or edge meaning.

## 14. Security, privacy, and trust

- Keep provider credentials server-side and encrypted at rest.
- Show which provider receives each request.
- Allow project-level exclusion from particular providers.
- Never send a source, manuscript, or entire canvas to a model unless it appears in the context manifest.
- Redact secrets from logs.
- Make telemetry opt-in for self-hosted deployments.
- Store model request/response logs under user control with configurable retention.
- Treat imported web content as untrusted data, not instructions.
- Separate tool instructions from retrieved source text to reduce prompt-injection risk.
- Sanitize rendered HTML and uploaded document output.
- Apply file-size, type, and extraction limits.

For a local-first future edition, consider IndexedDB storage and optional encrypted sync. This is not required to validate the product.

## 15. Collaboration and offline work

Real-time collaboration should be postponed until the single-user data model is stable. When introduced, [Yjs](https://docs.yjs.dev/) is a likely foundation for synchronising editor state and potentially shared graph collections.

Questions to resolve before collaboration:

- Is PostgreSQL state or the CRDT document authoritative?
- How are model-generated transactions merged?
- Can collaborators see one another's private provider credentials or model logs?
- How are comments, suggestions, presence, and permissions represented?
- How are large source files shared and versioned?

Offline support can begin more simply with cached reads and an outbox of node/position changes. Full offline collaborative editing is a separate product milestone.

## 16. MVP scope

### 16.1 Must have

- Create, rename, and save a project.
- Create/edit/delete typed cards.
- Pan, zoom, select, drag, resize, and connect.
- Branch from any card with immediate keyboard focus.
- Collapse and expand descendants.
- Auto-layout a new branch or selection.
- Search/filter nodes.
- Configure at least two model providers.
- Stream a model response into a new card.
- Display and edit the context manifest.
- Record model run provenance.
- Add pasted text, URLs, and text-based PDFs as sources.
- Create exact source excerpts.
- Connect excerpts to claims.
- Select canvas nodes and propose an outline.
- Reorder outline sections and references.
- Draft a section from approved nodes.
- Preserve paragraph-to-node and citation-to-excerpt backlinks.
- Export Markdown.
- Basic project backup/import as a documented JSON format.

### 16.2 Should have soon after

- Multiple manuscripts per canvas.
- Draft variants and comparison.
- Claim-source matrix.
- Markdown import.
- DOCX export.
- Project templates.
- Saved views.
- Cost/token display.
- Embedding-based related-node suggestions.
- Citation style support via CSL.
- Local OpenAI-compatible model endpoints.

### 16.3 Explicitly postponed

- Multiplayer editing.
- Mobile-native applications.
- Autonomous deep-research agents.
- Browser automation and paywall handling.
- Freehand whiteboarding.
- Image and video generation.
- Plugin marketplace.
- Fully automatic end-to-end essay generation.
- Dedicated graph database.

## 17. Delivery roadmap

### Milestone 0: Technical spikes

Goal: remove the largest architectural uncertainties.

- Build a React Flow canvas with editable custom cards.
- Test 500 lightweight nodes and streaming updates.
- Compare Lexical and Tiptap for citations, Markdown, custom backlinks, and clipboard behaviour.
- Build one AI SDK adapter with two providers and one OpenAI-compatible endpoint.
- Prototype node-to-outline structured generation.
- Prototype a citation marker that resolves to a stored excerpt.

Exit criterion: documented decisions and a disposable working demo.

### Milestone 1: Local canvas prototype

- Project and graph JSON storage.
- Typed cards and edges.
- Keyboard-first creation and editing.
- Branching, selection, collapse, minimap, and auto-layout.
- Basic undo/redo.
- No accounts or collaboration.

Exit criterion: a user can use the application as a pleasant manual research mind map.

### Milestone 2: Model-assisted exploration

- Provider settings and role presets.
- Streaming model nodes.
- Context preview and manifests.
- Model run history, cancellation, and retry.
- Suggested branches that the user accepts individually.

Exit criterion: users can explore parallel questions with different models without losing context control.

### Milestone 3: Sources and evidence

- URL, paste, and PDF ingestion.
- Source records and immutable excerpts.
- Claim/evidence/citation edges.
- Source inspector and claim-source matrix.
- Basic citation validation.

Exit criterion: a user can trace an important factual claim to exact captured evidence.

### Milestone 4: Manuscripts

- Outline generation from selected nodes.
- Drag-and-drop outline editing.
- Long-form editor.
- Section-by-section drafting.
- Passage provenance and citation markers.
- Markdown export.

Exit criterion: a user can turn a research graph into a coherent essay without copying material into another application.

### Milestone 5: Daily-use hardening

- PostgreSQL persistence and migrations.
- Authentication/self-host setup.
- Revision history and backups.
- Performance and accessibility work.
- Better imports/exports.
- Deployment documentation.
- Contributor documentation and sample projects.

Exit criterion: external users can install it and trust it with real work.

### Milestone 6: Optional collaboration and ecosystem

- Shared projects, comments, permissions, presence, and conflict handling.
- Extension points for node types, importers, exporters, and model actions.
- Local-first or desktop packaging investigation.

## 18. Initial repository shape

```text
branchwork/
├── apps/
│   └── web/
├── packages/
│   ├── domain/              # Node, edge, source, manuscript types
│   ├── graph/               # Traversal, context selection, layout adapters
│   ├── canvas-ui/           # React Flow nodes, edges, controls
│   ├── editor/              # Lexical configuration and custom elements
│   ├── models/              # Provider adapters, roles, capability checks
│   ├── research/            # Ingestion, excerpts, citation validation
│   ├── prompts/             # Versioned prompts and structured schemas
│   ├── database/            # Schema, migrations, repositories
│   ├── export/              # Markdown, JSON, later DOCX/CSL
│   └── ui/                  # Shared design-system components
├── examples/
│   ├── simple-essay/
│   └── source-backed-argument/
├── docs/
│   ├── architecture/
│   ├── product/
│   ├── contributing/
│   └── decisions/           # Architecture decision records
├── tests/
│   ├── fixtures/
│   └── performance/
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── LICENSE
└── README.md
```

A monorepo is useful here because the graph model, prompt schemas, citation logic, and UI should remain separable. Do not split into deployed microservices prematurely.

## 19. First contributor issues

These can become well-bounded public issues:

1. Scaffold the TypeScript monorepo and web application.
2. Define versioned Zod schemas for projects, nodes, edges, sources, and model runs.
3. Implement React Flow canvas persistence and viewport restoration.
4. Create `ResearchNodeShell` with read and edit states.
5. Implement keyboard creation of child and sibling nodes.
6. Implement typed edges and edge editing.
7. Add branch collapse/expand without deleting hidden descendants.
8. Add selection-scoped Dagre layout.
9. Build the context-preview data structure and UI without model calls.
10. Implement the model-adapter interface and one provider.
11. Stream generated content into a provisional node.
12. Add model run provenance inspector.
13. Add source and excerpt records using pasted text.
14. Implement claim-to-excerpt citation links.
15. Compare Lexical and Tiptap using a documented evaluation fixture.
16. Generate a structured outline from selected node IDs.
17. Build the outline drag-and-drop view.
18. Add manuscript paragraph backlinks.
19. Export a manuscript and citations to Markdown.
20. Create a 500/2,000-node performance fixture.

## 20. Testing strategy

### Unit tests

- Graph traversal and ancestry rules.
- Cycle prevention for `branches_from` edges.
- Context selection, ordering, deduplication, and trimming.
- Source/excerpt ID validation.
- Outline-to-node references.
- Model capability routing.
- Citation rendering.
- Import/export schema migrations.

### Integration tests

- Create a branch, reload, and preserve positions.
- Cancel and retry a streaming generation.
- Change a provider while retaining the logical role.
- Generate an outline from a known fixture.
- Draft a section containing valid and invalid citation IDs.
- Edit a source-backed paragraph and preserve provenance.
- Export and re-import a complete project.

### End-to-end tests

- Keyboard-only research session.
- URL/PDF to excerpt to claim to essay citation.
- Multiple manuscripts from one canvas.
- Large-canvas navigation and filtered views.
- Provider failure, timeout, rate limit, and malformed structured output.

### Evaluation fixtures

Prompt/model behaviour should be evaluated against checked-in projects with expected structural properties, not exact prose. Tests can measure:

- Whether all outline references correspond to supplied node IDs.
- Whether a drafted factual claim has an excerpt citation.
- Whether excluded nodes were omitted.
- Whether counterarguments remain represented.
- Whether citation IDs were fabricated.

## 21. Open-source considerations

### 21.1 Licence

Two sensible choices are:

- **Apache-2.0:** encourages broad adoption and commercial contribution while providing an explicit patent grant.
- **AGPL-3.0:** requires hosted modifications to remain available and may better protect the project from being absorbed into a closed SaaS product.

If the immediate aim is to attract the largest contributor and adopter base, Apache-2.0 is probably the simpler default. If preserving a permanently open hosted ecosystem is the priority, choose AGPL-3.0 deliberately and explain why. Do not combine incompatible assumptions across packages.

### 21.2 Open data format

The project should define a documented, versioned JSON export containing:

- Project metadata.
- Nodes and edges.
- Source metadata and excerpt locators.
- Manuscripts and outlines.
- Provenance references.
- Optional model run history.

Files may be stored beside the JSON in a ZIP archive. Users must be able to leave the application with their work even if some provider-specific metadata cannot be reproduced.

### 21.3 Contribution boundaries

Document extension points early:

- Node-type registry.
- Edge-type registry.
- Model-provider adapters.
- Model actions and prompt schemas.
- Source importers.
- Exporters.
- Layout engines.

Avoid a general plugin runtime until at least two real external extensions require one.

### 21.4 Governance and trust

Include a code of conduct, security reporting instructions, a public roadmap, architecture decision records, and transparent handling of model/provider affiliations. A sample project should work without paid APIs, using manual nodes or a local compatible endpoint.

## 22. Product decisions requiring early prototypes

The following should be answered by use, not extended theoretical debate:

1. **Editing location:** in-card expansion, inspector panel, or both?
2. **Canvas/manuscript relationship:** tabs, split view, or a mode switch?
3. **Card density:** how much text remains readable without overwhelming the canvas?
4. **Suggested branches:** ghost nodes, a menu, or a generated child list?
5. **Edge semantics:** how often will writers actually label relationships manually?
6. **Auto-layout:** should branches grow horizontally, vertically, or follow the user's local direction?
7. **Outline generation:** should it create one proposed structure or several alternatives?
8. **Provenance display:** inline badges, side-panel inspection, or reveal-on-demand?
9. **Editor foundation:** Lexical or Tiptap after the comparison spike?
10. **Storage posture:** local-first prototype or server-backed from the first public release?

## 23. Definition of a successful first public release

A first public release is successful when a new user can:

1. Install or open Branchwork without specialised infrastructure.
2. Begin with a question and build a branching canvas using both manual and model-authored cards.
3. See and control what context is sent for each model action.
4. Add at least one real source and connect an exact excerpt to a claim.
5. Select useful material and create an editable outline.
6. Draft a manuscript section whose citations and research ancestry remain inspectable.
7. Export the manuscript and a complete portable project archive.

The product does not need to perform autonomous research or write a perfect essay. It needs to make the user's thinking more visible, preserve the boundary between evidence and synthesis, and remove the mechanical labour of transferring a branching investigation into a linear draft.

## 24. Recommended immediate next steps

1. Choose the working name and licence.
2. Publish this concept as an initial `docs/product/concept.md`.
3. Create a short README with the proposition, a screenshot/mock-up, project status, and contributor invitation.
4. Open Milestone 0 issues for the React Flow canvas, editor comparison, provider adapter, outline schema, and citation prototype.
5. Build a narrow vertical slice:
   - create root question;
   - branch manually or through either of two models;
   - attach a pasted source excerpt;
   - mark one claim;
   - select the nodes;
   - produce an outline;
   - draft one cited paragraph;
   - reveal its research ancestry.
6. Test that slice on one real essay before adding breadth.
7. Record product and architecture decisions in public ADRs so contributors understand not only what was chosen but why.

That vertical slice contains the distinctive value of Branchwork. Everything else can grow around it incrementally.

---

## Reference links

- [React Flow](https://reactflow.dev/)
- [React Flow mind-map tutorial](https://reactflow.dev/learn/tutorials/mind-map-app-with-react-flow)
- [React Flow custom nodes](https://reactflow.dev/learn/customization/custom-nodes)
- [React Flow layout guidance](https://reactflow.dev/learn/layouting/layouting)
- [React Flow Dagre example](https://reactflow.dev/examples/layout/dagre)
- [React Flow ELK example](https://reactflow.dev/examples/layout/elkjs)
- [Lexical](https://lexical.dev/docs/intro)
- [tldraw](https://tldraw.dev/)
- [Vercel AI SDK](https://ai-sdk.dev/docs/introduction)
- [AI SDK provider management](https://ai-sdk.dev/v5/docs/ai-sdk-core/provider-management)
- [AI SDK structured generation](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [AI SDK OpenAI-compatible providers](https://ai-sdk.dev/providers/openai-compatible-providers)
- [Yjs](https://docs.yjs.dev/)

