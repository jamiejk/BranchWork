"use client";

import { useEffect } from "react";
import { useStore } from "../state/store";

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const state = useStore.getState();
      const target = event.target as HTMLElement | null;
      const inTextField =
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement ||
        (target?.isContentEditable ?? false);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        import("../state/persistence").then((m) => m.checkpoint("Manual checkpoint (Ctrl+S)"));
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        if (inTextField && !event.shiftKey) return;
        event.preventDefault();
        if (event.shiftKey) {
          state.redo();
        } else {
          state.undo();
        }
        return;
      }

      if (inTextField) return;

      const selected = state.selectedNodeIds;
      const primary = selected[0];

      if (event.key === "Tab") {
        event.preventDefault();
        if (primary) state.addChildNode(primary);
        return;
      }

      if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        if (primary) state.addSiblingNode(primary);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (primary) state.setEditingNode(primary);
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (state.selectedEdgeId) {
          event.preventDefault();
          state.deleteEdge(state.selectedEdgeId);
          return;
        }
        if (selected.length > 0) {
          event.preventDefault();
          state.deleteNodes(selected);
        }
        return;
      }

      if (event.key === ".") {
        if (selected.length > 0) {
          event.preventDefault();
          for (const id of [...selected]) state.toggleCollapse(id);
        }
        return;
      }

      if (event.key.toLowerCase() === "l" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        state.layoutSelection();
        return;
      }

      if (event.key.toLowerCase() === "e" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        import("../state/persistence").then((m) => m.downloadProjectJson());
        return;
      }

      if (event.key === "Escape") {
        if (state.contextPreview) {
          state.closeContextPreview();
          return;
        }
        state.setSelectedNodes([]);
        state.setSelectedEdge(null);
      }
    };

    // capture phase so no other handler can swallow shortcut keys first
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);
}
