"use client";

import type { ReactFlowInstance } from "@xyflow/react";

let instance: ReactFlowInstance | null = null;

export function setRfInstance(next: ReactFlowInstance | null): void {
  instance = next;
}

export function getRfInstance(): ReactFlowInstance | null {
  return instance;
}

export function focusNode(nodeId: string): boolean {
  if (!instance) return false;
  try {
    void instance.fitView({ nodes: [{ id: nodeId }], duration: 350, padding: 4, maxZoom: 1.1 });
    return true;
  } catch {
    return false;
  }
}
