import { describe, it, expect } from "vitest";
import {
  researchNodeSchema,
  createResearchNode,
  researchEdgeSchema,
  createResearchEdge,
  branchworkExportFileSchema,
  createExportBundle,
  derivePlainText,
  outlineSectionSchema,
} from "../src";

const projectId = "p_test";

function node(overrides: Partial<Parameters<typeof createResearchNode>[0]> = {}) {
  return createResearchNode({ projectId, type: "note", title: "T", content: "C", ...overrides });
}

describe("researchNodeSchema", () => {
  it("applies defaults", () => {
    const n = node();
    expect(n.status).toBe("draft");
    expect(n.authorKind).toBe("human");
    expect(n.tags).toEqual([]);
    expect(n.createdAt).toBeTruthy();
  });

  it("rejects unknown types and statuses", () => {
    const result = researchNodeSchema.safeParse({
      ...node(),
      type: "nonsense",
    });
    expect(result.success).toBe(false);
  });

  it("derives plain text from markdown-ish content", () => {
    const text = derivePlainText("# Heading\n\nSome **bold** and _em_ text");
    expect(text).toContain("Heading");
    expect(text).toContain("bold");
    expect(text).not.toContain("**");
  });
});

describe("researchEdgeSchema", () => {
  it("validates typed edges", () => {
    const e = createResearchEdge({
      projectId,
      sourceNodeId: "n_a",
      targetNodeId: "n_b",
      type: "supports",
      createdBy: "human",
    });
    expect(researchEdgeSchema.safeParse(e).success).toBe(true);
  });

  it("rejects unknown edge types", () => {
    const e = createResearchEdge({
      projectId,
      sourceNodeId: "n_a",
      targetNodeId: "n_b",
      type: "supports",
      createdBy: "human",
    });
    expect(researchEdgeSchema.safeParse({ ...e, type: "loves" }).success).toBe(false);
  });
});

describe("outlineSectionSchema", () => {
  it("accepts nested sections", () => {
    const section = {
      id: "s1",
      heading: "Intro",
      order: 0,
      nodeRefs: ["n_1"],
      children: [{ id: "s2", heading: "Background", order: 0, nodeRefs: [], children: [] }],
    };
    expect(outlineSectionSchema.safeParse(section).success).toBe(true);
  });
});

describe("branchworkExportFileSchema", () => {
  it("round-trips a project bundle", () => {
    const n = node();
    const e = createResearchEdge({
      projectId,
      sourceNodeId: n.id,
      targetNodeId: "n_x",
      type: "branches_from",
      createdBy: "human",
    });
    const bundle = createExportBundle({
      project: { id: projectId, title: "Test", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      nodes: [n],
      edges: [e],
    });
    expect(bundle.formatVersion).toBe(1);
    expect(branchworkExportFileSchema.safeParse(JSON.parse(JSON.stringify(bundle))).success).toBe(
      true
    );
  });
});
