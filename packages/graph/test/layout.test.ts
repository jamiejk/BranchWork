import { describe, it, expect } from "vitest";
import { createResearchEdge, createResearchNode } from "@branchwork/domain";
import type { ResearchEdge, ResearchNode } from "@branchwork/domain";
import { computeLayout, suggestChildPosition } from "../src/layout";

const projectId = "p_test";

function node(id: string) {
  return createResearchNode({
    id: `n_${id}`,
    projectId,
    type: "note",
    title: id,
    content: `Content for ${id}`,
    position: { x: 0, y: 0 },
    size: { width: 260, height: 120 },
  });
}

describe("computeLayout", () => {
  const nodes = [node("a"), node("b"), node("c"), node("d")];
  const edges: ResearchEdge[] = [
    createResearchEdge({ projectId, sourceNodeId: "n_a", targetNodeId: "n_b", type: "branches_from", createdBy: "human" }),
    createResearchEdge({ projectId, sourceNodeId: "n_a", targetNodeId: "n_c", type: "branches_from", createdBy: "human" }),
    createResearchEdge({ projectId, sourceNodeId: "n_b", targetNodeId: "n_d", type: "branches_from", createdBy: "human" }),
  ];
  const graph = { nodes, edges };

  it("lays out a subtree top-to-bottom with children below parent", () => {
    const result = computeLayout(graph, { kind: "subtree", rootIds: ["n_a"] });
    expect(result.positions.size).toBe(4);
    const a = result.positions.get("n_a")!;
    const b = result.positions.get("n_b")!;
    const d = result.positions.get("n_d")!;
    expect(b.y).toBeGreaterThan(a.y);
    expect(d.y).toBeGreaterThan(b.y);
  });

  it("only moves nodes in scope", () => {
    const result = computeLayout(graph, { kind: "selection", nodeIds: ["n_b", "n_d"] });
    expect(result.positions.has("n_a")).toBe(false);
    expect(result.positions.size).toBe(2);
  });

  it("suggests non-overlapping child slots", () => {
    const parent = nodes[0]!;
    const p1 = suggestChildPosition(parent, []);
    const p2 = suggestChildPosition(parent, [
      createResearchNode({ projectId, type: "note", title: "x", position: p1 }),
    ]);
    expect(p1.y).not.toBe(p2.y);
  });
});
