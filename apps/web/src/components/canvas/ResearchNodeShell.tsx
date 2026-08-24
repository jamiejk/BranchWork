"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import {
  NODE_TYPE_REGISTRY,
  NODE_STATUS_META,
  derivePlainText,
  type NodeId,
  type NodeType,
  type NodeStatus,
  type AuthorKind,
} from "@branchwork/domain";
import { useStore } from "../../state/store";
import { RichText } from "../../lib/richtext";

export interface ResearchNodeData {
  nodeId: NodeId;
  type: NodeType;
  title: string;
  content: string;
  plainText: string;
  status: NodeStatus;
  authorKind: AuthorKind;
  modelRunId?: string;
  selected: boolean;
  editing: boolean;
  collapsed: boolean;
  hiddenDescendants: number;
  streaming: boolean;
  busy: boolean;
  sized: boolean;
}

function statusDotClass(status: NodeStatus): string {
  return `bw-status-dot bw-status-${status}`;
}

const TYPE_CLASS: Partial<Record<NodeType, string>> = {
  question: "bw-type-question",
  claim: "bw-type-claim",
  counterclaim: "bw-type-counterclaim",
  evidence: "bw-type-evidence",
  excerpt: "bw-type-excerpt",
  source: "bw-type-source",
  exploration: "bw-type-exploration",
};

function ResearchNodeShellInner({ data }: NodeProps) {
  const card = data as unknown as ResearchNodeData;
  const store = useStore;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [titleEditing, setTitleEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [resizing, setResizing] = useState(false);
  const hoverTimer = useRef<number | undefined>(undefined);

  // Keep the resizer mounted for the whole life of a handle press: the drag
  // usually leaves the card bounds immediately, which would otherwise fire
  // mouseleave and unmount the controls mid-gesture.
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest?.(".react-flow__resize-control")) setResizing(true);
    };
    const up = () => {
      window.setTimeout(() => setResizing(false), 60);
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
    };
  }, []);

  const markHovered = (value: boolean) => {
    window.clearTimeout(hoverTimer.current);
    if (value) setHovered(true);
    else hoverTimer.current = window.setTimeout(() => setHovered(false), 150);
  };

  useEffect(() => {
    if (!card.editing) return;
    let frames = 0;
    let raf = 0;
    // React Flow keeps fresh nodes visibility:hidden until measured, so focus()
    // can silently fail; retry until activeElement really is the editor.
    const attempt = () => {
      const el = textareaRef.current;
      if (el && el.isConnected) {
        el.focus();
        if (document.activeElement === el) {
          const len = el.value.length;
          el.setSelectionRange(len, len);
          return;
        }
      }
      if (++frames < 120) raf = requestAnimationFrame(attempt);
    };
    raf = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(raf);
  }, [card.editing]);

  const commitEdit = () => {
    const state = store.getState();
    // ignore stale blur events after the editor already closed
    if (state.editingNodeId !== card.nodeId) return;
    const value = textareaRef.current?.value ?? "";
    const node = state.nodes[card.nodeId];

    // Title is always filled immediately from the first line so the card
    // never looks blank; the background model may replace it with a better
    // one shortly after.
    const nextTitle = value.split("\n")[0]?.slice(0, 110) || "";
    let content = value;
    if (nextTitle && content.startsWith(nextTitle)) {
      content = content.slice(nextTitle.length).replace(/^\s+/, "");
    }

    if (node && node.title === nextTitle && node.content === content) {
      state.setEditingNode(null);
      return;
    }
    state.updateNode(card.nodeId, { title: nextTitle, content });
    state.setEditingNode(null);
    state.setSelectedNodes([card.nodeId]);

    // Ask the background model to propose a sharper title (fire-and-forget).
    // generateTitle only overwrites if the user hasn't edited it meanwhile.
    if (nextTitle.trim()) {
      void store.getState().generateTitle(card.nodeId);
    }
  };

  const commitTitle = () => {
    const el = titleInputRef.current;
    if (!el) return;
    const next = el.value.trim().slice(0, 110);
    const node = store.getState().nodes[card.nodeId];
    setTitleEditing(false);
    if (!node || node.title === next) return;
    store.getState().updateNode(card.nodeId, { title: next });
  };

  const bodyText =
    card.plainText.trim() || derivePlainText(card.content).trim() || "Empty card — double-click to write.";
  const richBody = (card.content ?? "").trim() !== "" ? <RichText text={card.content} /> : null;

  return (
    <>
      <NodeResizer
        isVisible={(hovered || resizing || card.selected) && !card.editing}
        minWidth={220}
        minHeight={110}
        lineClassName="bw-resize-line"
        handleClassName="bw-resize-handle"
        onResizeStart={() => setResizing(true)}
        onResizeEnd={(_, params) => {
          store.getState().setNodeSize(card.nodeId, {
            width: Math.round(params.width),
            height: Math.round(params.height),
          });
        }}
      />
      <div
        onMouseEnter={() => markHovered(true)}
        onMouseLeave={() => markHovered(false)}
        className={[
          "bw-card",
          TYPE_CLASS[card.type] ?? "",
          card.selected ? "bw-card-selected" : "",
          card.status === "excluded" ? "bw-card-excluded" : "",
          card.sized ? "bw-card-sized" : "",
          card.streaming ? "bw-card-streaming" : "",
          card.busy ? "bw-card-busy" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Handle type="target" position={Position.Top} id="t-top" className="bw-handle" />
        <Handle type="target" position={Position.Left} id="t-left" className="bw-handle bw-handle-side" />
        {/* header is a grab surface; only its buttons opt out of dragging */}
        <div className="bw-card-header">
        <span className={`bw-chip ${TYPE_CLASS[card.type] ?? ""}`}>
          {NODE_TYPE_REGISTRY[card.type].label}
        </span>
        <span className={statusDotClass(card.status)} title={`Status: ${NODE_STATUS_META[card.status].label}`} />
        {card.authorKind === "model" && (
          <span className="bw-chip bw-chip-model" title="Generated by a model run">
            ✦ model
          </span>
        )}
        {card.authorKind === "import" && (
          <span className="bw-chip bw-chip-import">⤓ import</span>
        )}
        <span className="bw-card-spacer" />
        {card.collapsed && (
          <button
            className="bw-mini-btn nodrag"
            title="Expand branch"
            onClick={() => store.getState().toggleCollapse(card.nodeId)}
          >
            +{card.hiddenDescendants}
          </button>
        )}
      </div>

      {card.editing ? (
        <div className="bw-card-editwrap nowheel nodrag">
          <textarea
            ref={textareaRef}
            className="bw-card-editor"
            defaultValue={card.content}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                commitEdit();
              }
              e.stopPropagation();
            }}
            placeholder="Write the body of this card…"
            rows={6}
          />
        </div>
      ) : card.streaming ? (
        <div className="bw-streaming nodrag nowheel">
          <span className="bw-streaming-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="bw-streaming-label">Generating…</span>
        </div>
      ) : (
        <div className="bw-card-body">
          {titleEditing ? (
            <input
              ref={titleInputRef}
              className="bw-title-input nodrag nowheel"
              defaultValue={card.title}
              autoFocus
              placeholder="Untitled"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  commitTitle();
                } else if (e.key === "Escape" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  setTitleEditing(false);
                }
                e.stopPropagation();
              }}
              onBlur={commitTitle}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            card.title && (
              <div
                className="bw-card-title"
                title="Click to edit the title (body is edited separately) — drag to move the card"
                onClick={(e) => {
                  e.stopPropagation();
                  setTitleEditing(true);
                }}
              >
                {card.title}
              </div>
            )
          )}
          <div className="bw-card-text">{richBody ?? bodyText}</div>
        </div>
      )}

      {card.selected && !card.editing && (
        <div className="bw-card-toolbar nodrag">
          <button
            className="bw-tool-btn"
            title="Add child card (Tab)"
            onClick={(e) => {
              e.stopPropagation();
              store.getState().addChildNode(card.nodeId);
            }}
          >
            ＋ child
          </button>
          <button
            className="bw-tool-btn"
            title="Suggest related sources, people and concepts"
            onClick={(e) => {
              e.stopPropagation();
              void store.getState().buildOutBranch(card.nodeId);
            }}
          >
            🌱 build
          </button>
          <button
            className="bw-tool-btn"
            title="Explore from here with a model"
            onClick={(e) => {
              e.stopPropagation();
              store.getState().openContextPreview(card.nodeId);
            }}
          >
            ✦ ask
          </button>
          <button
            className="bw-tool-btn"
            title="Collapse / expand descendants (.)"
            onClick={(e) => {
              e.stopPropagation();
              store.getState().toggleCollapse(card.nodeId);
            }}
          >
            ⤡ fold
          </button>
          <button
            className="bw-tool-btn bw-danger"
            title="Delete card"
            onClick={(e) => {
              e.stopPropagation();
              store.getState().deleteNodes([card.nodeId]);
            }}
          >
            ✕
          </button>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} id="s-bottom" className="bw-handle" />
      <Handle type="source" position={Position.Right} id="s-right" className="bw-handle bw-handle-side" />
      </div>
    </>
  );
}

export const ResearchNodeShell = memo(ResearchNodeShellInner, (a, b) => {
  const prev = a.data as unknown as ResearchNodeData;
  const next = b.data as unknown as ResearchNodeData;
  return (
    prev.nodeId === next.nodeId &&
    prev.type === next.type &&
    prev.title === next.title &&
    prev.content === next.content &&
    prev.plainText === next.plainText &&
    prev.status === next.status &&
    prev.authorKind === next.authorKind &&
    prev.modelRunId === next.modelRunId &&
    prev.selected === next.selected &&
    prev.editing === next.editing &&
    prev.collapsed === next.collapsed &&
    prev.hiddenDescendants === next.hiddenDescendants &&
    prev.streaming === next.streaming &&
    prev.sized === next.sized &&
    prev.busy === next.busy
  );
});
