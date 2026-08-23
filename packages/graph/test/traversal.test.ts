import { describe, it, expect } from "vitest";
import { createResearchEdge, createResearchNode } from "@branchwork/domain";
import type { ResearchEdge, ResearchNode } from "@branchwork/domain";
import {
  ancestorsOf,
  descendantIds,
  wouldCreateAncestryCycle,
  hasAncestryEdge,
  buildParentMap,
} from "../src/traversal";

const projectId = "p_test";

function makeGraph(shape: Record<string, string[]>): {
  nodes: ResearchNode[];
  edges: ResearchEdge[];
} {
  const allIds = new Set<string>([...Object.keys(shape), ...Object.values(shape).flat()]);
  const nodes = [...allIds].map((id) =>
    createResearchNode({ id: `n_${id}`, projectId, type: "note", title: id })
  );
  const edges: ResearchEdge[] = [];
  for (const [parent, children] of Object.entries(shape)) {
    for (const child of children) {
      edges.push(
        createResearchEdge({
          projectId,
          sourceNodeId: `n_${parent}`,
          targetNodeId: `n_${child}`,
          type: "branches_from",
          createdBy: "human",
        })
      );
    }
  }
  return { nodes, edges };
}

describe("traversal", () => {
  it("walks ancestors root-first", () => {
    const { edges } = makeGraph({ a: ["b"], b: ["c"], c: ["d"] });
    expect(ancestorsOf(edges, "n_d")).toEqual(["n_c", "n_b", "n_a"]);
  });

  it("collects descendants including nested", () => {
    const { edges } = makeGraph({ a: ["b", "c"], b: ["d"] });
    expect(new Set(descendantIds(edges, ["n_a"]))).toEqual(new Set(["n_b", "n_c", "n_d"]));
  });

  it("detects cycles before adding ancestry edge", () => {
    const { edges } = makeGraph({ a: ["b"], b: ["c"] });
    expect(wouldCreateAncestryCycle(edges, "n_c", "n_a")).toBe(true);
    expect(wouldCreateAncestryCycle(edges, "n_a", "n_c")).toBe(false);
    expect(wouldCreateAncestryCycle(edges, "n_a", "n_a")).toBe(true);
  });

  it("checks existing ancestry edges", () => {
    const { edges } = makeGraph({ a: ["b"] });
    expect(hasAncestryEdge(edges, "n_a", "n_b")).toBe(true);
    expect(hasAncestryEdge(edges, "n_b", "n_a")).toBe(false);
  });

  it("parent map keeps first parent for multi-parent nodes", () => {
    const { edges } = makeGraph({ a: ["c"], b: ["c"] });
    expect(buildParentMap(edges).get("n_c")).toBe("n_a");
  });

  it("ignores non-ancestry edge types", () => {
    const projectId2 = "p_test";
    const supports = createResearchEdge({
      projectId: projectId2,
      sourceNodeId: "n_b",
      targetNodeId: "n_a",
      type: "supports",
      createdBy: "human",
    });
    const { edges } = makeGraph({});
    expect(wouldCreateAncestryCycle([...edges, supports], "n_a", "n_b")).toBe(false);
    expect(ancestorsOf([...edges, supports], "n_a")).toEqual([]);
  });
});
