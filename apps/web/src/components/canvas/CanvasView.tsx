"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge as RfEdge,
  type Node as RfNode,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import { computeHiddenNodeIds } from "@branchwork/graph";
import { NODE_TYPES, NODE_TYPE_REGISTRY, type EdgeId, type NodeType } from "@branchwork/domain";
import { useStore } from "../../state/store";
import { setRfInstance } from "../../lib/rf";
import { ResearchNodeShell, type ResearchNodeData } from "./ResearchNodeShell";
import { BranchEdge } from "./BranchEdge";
import { ContextPreviewPanel } from "./ContextPreviewPanel";
import { ModelRunTray } from "../ModelRunTray";

const nodeTypes = { research: ResearchNodeShell };
const edgeTypes = { branch: BranchEdge };

function CanvasInner() {
  const { fitView, screenToFlowPosition } = useReactFlow();
  const [ctxMenu, setCtxMenu] = useState<{
    screenX: number;
    screenY: number;
    flowX: number;
    flowY: number;
    connect?: { sourceId: string; sourceHandle: string | null };
    breakOut?: { sourceNodeId: string; text: string };
  } | null>(null);
  const pendingConnect = useRef<{ sourceId: string; sourceHandle: string | null } | null>(null);
  /** Last non-empty text selection inside a card, captured on selectionchange
   *  because the right-click itself collapses the live selection. */
  const lastCardSelection = useRef<{ nodeId: string; text: string } | null>(null);

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      // user-select:none regions yield an empty toString(); read the range
      const text = (sel.toString() || sel.getRangeAt(0).toString()).trim();
      if (!text) return;
      const anchorEl = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
      const nodeEl = anchorEl?.closest(".react-flow__node");
      const nodeId = nodeEl?.getAttribute("data-id");
      if (nodeId && nodeEl?.querySelector(".bw-card")) {
        lastCardSelection.current = { nodeId, text };
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);
  const nodesRecord = useStore((s) => s.nodes);
  const edgesRecord = useStore((s) => s.edges);
  const collapsedIds = useStore((s) => s.collapsedIds);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const selectedEdgeId = useStore((s) => s.selectedEdgeId);
  const editingNodeId = useStore((s) => s.editingNodeId);
  const streamingRunIds = useStore((s) => s.streamingRunIds);
  const storedViewport = useStore((s) => s.viewport);
  const initializedRef = useRef(false);

  const streamingRunSet = useMemo(() => new Set(streamingRunIds), [streamingRunIds]);

  const hiddenIds = useMemo(
    () => computeHiddenNodeIds(Object.values(edgesRecord), Object.keys(collapsedIds)),
    [edgesRecord, collapsedIds]
  );

  const childCountByParent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of Object.values(edgesRecord)) {
      if (edge.type !== "branches_from") continue;
      if (!hiddenIds.has(edge.targetNodeId)) continue;
      counts.set(edge.sourceNodeId, (counts.get(edge.sourceNodeId) ?? 0) + 1);
    }
    return counts;
  }, [edgesRecord, hiddenIds]);

  const rfNodes: RfNode[] = useMemo(
    () =>
      Object.values(nodesRecord)
        .filter((node) => !hiddenIds.has(node.id))
        .map((node) => {
          const data: ResearchNodeData = {
            nodeId: node.id,
            type: node.type,
            title: node.title,
            content: node.content,
            plainText: node.plainText,
            status: node.status,
            authorKind: node.authorKind,
            modelRunId: node.modelRunId,
            selected: selectedNodeIds.includes(node.id),
            editing: editingNodeId === node.id,
            collapsed: Boolean(collapsedIds[node.id]),
            hiddenDescendants: childCountByParent.get(node.id) ?? 0,
            streaming: Boolean(node.modelRunId && streamingRunSet.has(node.modelRunId)),
            sized: Boolean(node.size?.height),
          };
          return {
            id: node.id,
            type: "research" as const,
            position: node.position,
            // explicit size only when the user has resized; otherwise the card
            // auto-sizes from content (default width via CSS)
            style:
              node.size
                ? {
                    width: node.size.width,
                    ...(node.size.height ? { height: node.size.height } : {}),
                  }
                : undefined,
            selected: selectedNodeIds.includes(node.id),
            data: data as unknown as Record<string, unknown>,
          };
        }),
    [
      nodesRecord,
      hiddenIds,
      selectedNodeIds,
      editingNodeId,
      collapsedIds,
      childCountByParent,
      streamingRunSet,
    ]
  );

  const rfEdges: RfEdge[] = useMemo(
    () =>
      Object.values(edgesRecord)
        .filter((edge) => !hiddenIds.has(edge.sourceNodeId) && !hiddenIds.has(edge.targetNodeId))
        .map((edge) => ({
          id: edge.id,
          source: edge.sourceNodeId,
          target: edge.targetNodeId,
          ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
          ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
          type: "branch" as const,
          selected: selectedEdgeId === edge.id,
          data: {
            edgeId: edge.id,
            type: edge.type,
            label: edge.label,
            selected: selectedEdgeId === edge.id,
          } as unknown as Record<string, unknown>,
        })),
    [edgesRecord, hiddenIds, selectedEdgeId]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const state = useStore.getState();
      for (const change of changes) {
        if (change.type === "position" && "position" in change && change.position) {
          state.setNodePosition(change.id, change.position);
        } else if (
          change.type === "dimensions" &&
          "resizing" in change &&
          change.resizing &&
          "dimensions" in change &&
          change.dimensions
        ) {
          // only user-initiated resizes persist; passive measurements never do,
          // so cards keep auto-sizing to their content
          state.setNodeSize(change.id, {
            width: Math.round(change.dimensions.width),
            height: Math.round(change.dimensions.height),
          });
        } else if (change.type === "remove") {
          state.deleteNodes([change.id]);
        }
      }
      const selectChanges = changes.filter(
        (change): change is Extract<NodeChange, { type: "select" }> => change.type === "select"
      );
      if (selectChanges.length > 0) {
        const selection = new Set(state.selectedNodeIds);
        for (const change of selectChanges) {
          if (change.selected) selection.add(change.id);
          else selection.delete(change.id);
        }
        state.setSelectedNodes([...selection]);
      }
    },
    []
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const state = useStore.getState();
    let selectedId: EdgeId | null | undefined;
    for (const change of changes) {
      if (change.type === "remove") {
        state.deleteEdge(change.id);
      } else if (change.type === "select") {
        selectedId = change.selected ? change.id : null;
      }
    }
    if (selectedId !== undefined) state.setSelectedEdge(selectedId);
  }, []);

  const onConnect = useCallback(
    (params: {
      source: string | null;
      target: string | null;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }) => {
      if (!params.source || !params.target) return;
      useStore.getState().connectNodes(params.source, params.target, {
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
      });
    },
    []
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setCtxMenu({ screenX: event.clientX, screenY: event.clientY, flowX: flow.x, flowY: flow.y });
    },
    [screenToFlowPosition]
  );

  const createFromMenu = useCallback(
    (type: NodeType) => {
      if (!ctxMenu) return;
      const state = useStore.getState();
      const newNodeId = state.createNodeAt(type, { x: ctxMenu.flowX, y: ctxMenu.flowY });
      if (ctxMenu.connect) {
        // the drag-out that opened this menu becomes a branch edge
        state.connectNodes(ctxMenu.connect.sourceId, newNodeId, {
          sourceHandle: ctxMenu.connect.sourceHandle,
        });
      }
      setCtxMenu(null);
    },
    [ctxMenu]
  );

  const breakOutFromMenu = useCallback(() => {
    if (!ctxMenu?.breakOut) return;
    useStore.getState().breakOutSelection(ctxMenu.breakOut.sourceNodeId, ctxMenu.breakOut.text);
    setCtxMenu(null);
    window.getSelection()?.removeAllRanges();
  }, [ctxMenu]);

  const onConnectStart = useCallback((_: unknown, params: { nodeId?: string | null; handleId?: string | null }) => {
    if (params.nodeId) {
      pendingConnect.current = { sourceId: params.nodeId, sourceHandle: params.handleId ?? null };
    }
  }, []);

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState?: { isValid?: boolean | null } | undefined) => {
      const pending = pendingConnect.current;
      if (!pending || (event as MouseEvent).clientX === undefined) return;
      if (connectionState?.isValid) {
        pendingConnect.current = null;
        return;
      }
      // released over empty canvas: offer node types; picking one creates and connects
      const point =
        "changedTouches" in event ? event.changedTouches[0] : (event as MouseEvent);
      if (!point) return;
      const flow = screenToFlowPosition({ x: point.clientX, y: point.clientY });
      setCtxMenu({
        screenX: point.clientX,
        screenY: point.clientY,
        flowX: flow.x,
        flowY: flow.y,
        connect: pending,
      });
      pendingConnect.current = null;
    },
    [screenToFlowPosition]
  );

  useEffect(() => {
    if (!ctxMenu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCtxMenu(null);
    };
    const dismiss = () => setCtxMenu(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", dismiss, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", dismiss);
    };
  }, [ctxMenu]);

  return (
    <div className="bw-canvas-wrap">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          const captured = lastCardSelection.current;
          const hasSelection = captured?.nodeId === node.id && captured.text.length > 0;
          console.log("[ctxmenu] node:", node.id, "captured:", JSON.stringify(captured));
          setCtxMenu({
            screenX: event.clientX,
            screenY: event.clientY,
            flowX: node.position.x,
            flowY: node.position.y,
            ...(hasSelection ? { breakOut: { sourceNodeId: node.id, text: captured.text } } : {}),
          });
        }}
        onPaneClick={() => setCtxMenu(null)}
        onMoveStart={() => setCtxMenu(null)}
        onNodeDoubleClick={(_, node) => useStore.getState().setEditingNode(node.id)}
        onNodeDragStart={() => useStore.getState().pushHistory()}
        onMoveEnd={(_, vp) => useStore.getState().setViewport(vp)}
        onInit={(instance) => {
          setRfInstance(instance);
          if (!initializedRef.current) {
            initializedRef.current = true;
            if (storedViewport) {
              instance.setViewport(storedViewport, { duration: 0 });
            } else {
              requestAnimationFrame(() => void fitView({ padding: 0.25, maxZoom: 1 }));
            }
          }
        }}
        deleteKeyCode={null}
        multiSelectionKeyCode="Shift"
        zoomOnDoubleClick={false}
        nodeDragThreshold={4}
        selectNodesOnDrag={false}
        connectionRadius={100}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        panOnScroll={false}
        minZoom={0.15}
        maxZoom={2.5}
        className="bw-flow"
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.4} color="#d7dce3" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable maskColor="rgba(250,250,248,0.7)" className="bw-minimap" />
      </ReactFlow>
      {ctxMenu && (
        <div
          className="bw-ctx-backdrop"
          onClick={() => setCtxMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu(null);
          }}
        >
          <div
            className="bw-context-menu"
            style={{ left: ctxMenu.screenX, top: ctxMenu.screenY }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="bw-ctx-header">
              {ctxMenu.breakOut ? "Break out" : ctxMenu.connect ? "Branch into new card" : "New card"}
            </p>
            {ctxMenu.breakOut && (
              <>
                <button className="bw-ctx-item bw-ctx-breakout" onClick={breakOutFromMenu}>
                  <span className="bw-ctx-item-title">✂ Break selection into new card</span>
                  <span className="bw-ctx-item-hint">
                    “{ctxMenu.breakOut.text.slice(0, 60)}{ctxMenu.breakOut.text.length > 60 ? "…" : ""}”
                  </span>
                </button>
                <div className="bw-ctx-divider" />
              </>
            )}
            {NODE_TYPES.map((type) => (
              <button key={type} className="bw-ctx-item" onClick={() => createFromMenu(type)}>
                <span className="bw-ctx-item-title">{NODE_TYPE_REGISTRY[type].label}</span>
                <span className="bw-ctx-item-hint">{NODE_TYPE_REGISTRY[type].hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <ContextPreviewPanel />
      <ModelRunTray />
    </div>
  );
}

export function CanvasView() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
