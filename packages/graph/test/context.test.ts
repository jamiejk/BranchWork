import { describe, it, expect } from "vitest";
import { createResearchEdge, createResearchNode } from "@branchwork/domain";
import type { ResearchEdge, ResearchNode } from "@branchwork/domain";
import { assembleContext, formatContext } from "../src/context";
import { estimateTokens } from "../src/tokens";

const projectId = "p_test";

function makeNode(
  id: string,
  type: Parameters<typeof createResearchNode>[0]["type"],
  content: string,
  overrides: Partial<Parameters<typeof createResearchNode>[0]> = {}
): ResearchNode {
  return createResearchNode({ id: `n_${id}`, projectId, type, content, ...overrides });
}

function makeEdge(source: string, target: string, type: Parameters<typeof createResearchEdge>[0]["type"]) {
  return createResearchEdge({
    projectId,
    sourceNodeId: source,
    targetNodeId: target,
    type,
    createdBy: "human",
  });
}

describe("assembleContext", () => {
  const nodes: ResearchNode[] = [
    makeNode("root", "question", "What is the effect of remote work on productivity?"),
    makeNode("note", "note", "Remote work removes commuting overhead."),
    makeNode("claim", "claim", "Remote work increases focus time."),
    makeNode("excerpt", "excerpt", "Focus hours rose by 12% in the study sample."),
    makeNode("tangent", "note", "Coffee consumption also rose."),
  ];
  const edges: ResearchEdge[] = [
    makeEdge("n_root", "n_note", "branches_from"),
    makeEdge("n_note", "n_claim", "branches_from"),
    makeEdge("n_excerpt", "n_claim", "supports"),
  ];
  const graph = { nodes, edges };

  it("local mode includes only focal node", () => {
    const manifest = assembleContext({ focalNodeIds: ["n_claim"], mode: "local" }, graph);
    expect(manifest.includedNodeIds).toEqual(["n_claim"]);
  });

  it("branch mode includes ancestors root-first then focal", () => {
    const manifest = assembleContext({ focalNodeIds: ["n_claim"], mode: "branch" }, graph);
    expect(manifest.includedNodeIds).toEqual(["n_root", "n_note", "n_claim"]);
  });

  it("evidence mode adds connected excerpt nodes", () => {
    const manifest = assembleContext({ focalNodeIds: ["n_claim"], mode: "evidence" }, graph);
    expect(manifest.includedNodeIds).toContain("n_excerpt");
    const roles = manifest.items.map((item) => item.role);
    expect(roles).toEqual(["framing", "framing", "evidence", "focal"]);
    expect(manifest.includedNodeIds).toEqual(["n_root", "n_note", "n_excerpt", "n_claim"]);
  });

  it("respects excluded nodes and statuses", () => {
    const manifest = assembleContext(
      {
        focalNodeIds: ["n_claim"],
        mode: "branch",
        excludedNodeIds: ["n_root"],
      },
      graph
    );
    expect(manifest.includedNodeIds).not.toContain("n_root");
  });

  it("retrieval mode ranks by keyword overlap", () => {
    const manifest = assembleContext(
      {
        focalNodeIds: ["n_root"],
        mode: "retrieval",
        query: "focus productivity study",
      },
      graph
    );
    expect(manifest.includedNodeIds).toContain("n_claim");
    expect(manifest.includedNodeIds).not.toContain("n_tangent");
  });

  it("trims lowest priority items when over budget", () => {
    const bigNodes: ResearchNode[] = Array.from({ length: 30 }, (_, i) =>
      makeNode(`big${i}`, "note", `Filler note number ${i} `.repeat(40))
    );
    const bigEdges: ResearchEdge[] = [];
    for (let i = 1; i < bigNodes.length; i++) {
      bigEdges.push(makeEdge(bigNodes[i - 1]!.id, bigNodes[i]!.id, "branches_from"));
    }
    const manifest = assembleContext(
      {
        focalNodeIds: [bigNodes[bigNodes.length - 1]!.id],
        mode: "branch",
        tokenBudget: 800,
      },
      { nodes: bigNodes, edges: bigEdges }
    );
    expect(manifest.estimatedTokens).toBeLessThanOrEqual(900);
    expect(manifest.truncated).toBe(true);
    expect(manifest.includedNodeIds.at(-1)).toBe(bigNodes[bigNodes.length - 1]!.id);
  });

  it("formats stable headers with ids and types", () => {
    const manifest = assembleContext({ focalNodeIds: ["n_claim"], mode: "local" }, graph);
    const text = formatContext(manifest);
    expect(text).toContain(`[NODE n_claim | type=claim | author=human]`);
  });

  it("token estimates track size", () => {
    expect(estimateTokens("abcd".repeat(100))).toBe(100);
  });
});
