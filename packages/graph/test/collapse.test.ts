import { describe, it, expect } from "vitest";
import { createResearchEdge } from "@branchwork/domain";
import { computeHiddenNodeIds, isEdgeHidden } from "../src/collapse";

const projectId = "p_test";

function edge(source: string, target: string) {
  return createResearchEdge({
    projectId,
    sourceNodeId: source,
    targetNodeId: target,
    type: "branches_from",
    createdBy: "human",
  });
}

const edges = [
  edge("n_a", "n_b"),
  edge("n_b", "n_c"),
  edge("n_a", "n_d"),
  edge("n_d", "n_e"),
];

describe("collapse", () => {
  it("hides descendants of collapsed nodes without deleting them", () => {
    const hidden = computeHiddenNodeIds(edges, ["n_b"]);
    expect(hidden.has("n_c")).toBe(true);
    expect(hidden.has("n_b")).toBe(false);
    expect(hidden.has("n_a")).toBe(false);
    expect(hidden.has("n_d")).toBe(false);
  });

  it("hides entire nested chains but keeps other branches visible", () => {
    const hidden = computeHiddenNodeIds(edges, ["n_a"]);
    expect(new Set([...hidden].sort())).toEqual(new Set(["n_b", "n_c", "n_d", "n_e"]));
  });

  it("edge visibility follows hidden endpoints", () => {
    const hidden = computeHiddenNodeIds(edges, ["n_b"]);
    expect(isEdgeHidden(edges[0] as never, hidden)).toBe(false);
    expect(isEdgeHidden(edges[1] as never, hidden)).toBe(true);
    expect(isEdgeHidden(edges[3] as never, hidden)).toBe(false);
  });

  it("returns empty set when nothing is collapsed", () => {
    expect(computeHiddenNodeIds(edges, []).size).toBe(0);
  });
});
