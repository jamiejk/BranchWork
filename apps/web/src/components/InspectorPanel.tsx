"use client";

import {
  EDGE_TYPE_LABELS,
  NODE_STATUSES,
  NODE_TYPES,
  cardTypeMeta,
  customTypeId,
  NODE_STATUS_META,
  type EdgeType,
  type NodeStatus,
} from "@branchwork/domain";
import { useEffect, useState } from "react";
import { useStore } from "../state/store";

const SHORTCUTS: [string, string][] = [
  ["Tab", "New child under selection"],
  ["Shift+Enter", "New sibling"],
  ["Enter", "Edit selected card"],
  ["Esc", "Finish editing / clear selection"],
  ["Delete", "Delete selected card or edge"],
  ["Ctrl/⌘+Z", "Undo"],
  ["Ctrl/⌘+L", "Lay out selected branch"],
  ["Ctrl/⌘+E", "Export project JSON"],
  ["Double-click edge label", "Select edge, change its type here →"],
];

export function InspectorPanel() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const selectedEdgeId = useStore((s) => s.selectedEdgeId);
  const setEdgeType = useStore((s) => s.setEdgeType);
  const deleteEdge = useStore((s) => s.deleteEdge);

  const node =
    selectedNodeIds.length === 1 ? nodes[selectedNodeIds[0] as string] : undefined;
  const edge = selectedEdgeId ? edges[selectedEdgeId] : undefined;

  if (edge) {
    return (
      <aside className="bw-inspector">
        <h3>Connection</h3>
        <label className="bw-field">
          Type
          <select
            value={edge.type}
            onChange={(e) => setEdgeType(edge.id, e.target.value as EdgeType)}
          >
            {(Object.keys(EDGE_TYPE_LABELS) as EdgeType[]).map((t) => (
              <option key={t} value={t}>
                {EDGE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <p className="bw-muted">
          {nodes[edge.sourceNodeId]?.title || edge.sourceNodeId} →{" "}
          {nodes[edge.targetNodeId]?.title || edge.targetNodeId}
        </p>
        <button className="btn bw-danger-btn" onClick={() => deleteEdge(edge.id)}>
          Delete connection
        </button>
      </aside>
    );
  }

  if (node) {
    return <NodeInspector nodeId={node.id} />;
  }

  return (
    <aside className="bw-inspector">
      <h3>Branchwork</h3>
      <p className="bw-muted">
        Select a card to edit its type, status, and tags. Nothing here is decoration — types drive
        context assembly, citations, and outlines.
      </p>
      <h4>Keyboard</h4>
      <dl className="bw-shortcuts">
        {SHORTCUTS.map(([keys, description]) => (
          <div key={keys} className="bw-shortcut-row">
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

/** Inspector body for a selected card, with card-type switching + creation. */
function NodeInspector({ nodeId }: { nodeId: string }) {
  const node = useStore((s) => s.nodes[nodeId]);
  const customTypes = useStore((s) => s.project.customCardTypes ?? []);
  const updateNode = useStore((s) => s.updateNode);
  const addCustomCardType = useStore((s) => s.addCustomCardType);
  const [creating, setCreating] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");

  if (!node) {
    return (
      <aside className="bw-inspector">
        <p className="bw-muted">That card no longer exists.</p>
      </aside>
    );
  }

  const meta = cardTypeMeta(node.type, customTypes);

  const commitNewType = () => {
    if (!draftLabel.trim()) return;
    const created = addCustomCardType(draftLabel);
    setCreating(false);
    setDraftLabel("");
    if (created) updateNode(node.id, { type: created });
  };

  return (
    <aside className="bw-inspector">
      <h3>{meta.label}</h3>
      <p className="bw-muted mono">{node.id}</p>
      <label className="bw-field">
        Card type
        <select
          value={creating ? "__new__" : node.type}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__new__") {
              setCreating(true);
              return;
            }
            updateNode(node.id, { type: v });
          }}
        >
          {NODE_TYPES.map((t) => (
            <option key={t} value={t}>
              {cardTypeMeta(t, customTypes).label}
            </option>
          ))}
          {(customTypes ?? []).length > 0 && (
            <optgroup label="Project types">
              {customTypes.map((c) => (
                <option key={c.id} value={customTypeId(c.id)}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          )}
          {!creating && <option value="__new__">＋ New card type…</option>}
        </select>
      </label>
      {creating && (
        <div className="bw-newtype-row">
          <input
            autoFocus
            value={draftLabel}
            placeholder="e.g. Scene"
            aria-label="New card type name"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) commitNewType();
              if (e.key === "Escape") {
                setCreating(false);
                setDraftLabel("");
              }
            }}
            onChange={(e) => setDraftLabel(e.target.value)}
          />
          <button
            className="btn btn-small btn-primary"
            disabled={!draftLabel.trim()}
            onClick={commitNewType}
          >
            Create
          </button>
        </div>
      )}
      <label className="bw-field">
        Status
        <select
          value={node.status}
          onChange={(e) => updateNode(node.id, { status: e.target.value as NodeStatus })}
        >
          {NODE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {NODE_STATUS_META[s].label}
            </option>
          ))}
        </select>
      </label>
      <TagEditor key={node.id} nodeId={node.id} tags={node.tags} />
      <p className="bw-hint">
        Created {new Date(node.createdAt).toLocaleString()}
        <br />
        Updated {new Date(node.updatedAt).toLocaleTimeString()}
      </p>
      {node.modelRunId && (
        <p className="bw-provenance">
          ✦ Generated by model run <code>{node.modelRunId}</code>. Human edits are preserved.
        </p>
      )}
    </aside>
  );
}

function TagEditor({
  nodeId,
  tags,
}: {
  nodeId: string;
  tags: string[];
}) {
  const updateNode = useStore((s) => s.updateNode);
  const [draft, setDraft] = useState(tags.join(", "));

  useEffect(() => {
    setDraft(tags.join(", "));
  }, [tags.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    const next = draft
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (next.join(",") !== tags.join(",")) updateNode(nodeId, { tags: next });
  };

  return (
    <label className="bw-field">
      Tags (comma separated)
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
    </label>
  );
}
