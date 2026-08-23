export * from "@branchwork/domain";

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface MockOutlineSection {
  heading: string;
  purpose: string;
  nodeRefs: string[];
}

export function buildMockOutlinePayload(
  nodes: { id: string; type: string; title: string }[]
): { sections: MockOutlineSection[] } {
  const claims = nodes.filter((n) => n.type === "claim" || n.type === "counterclaim");
  const evidence = nodes.filter((n) =>
    ["excerpt", "evidence", "example", "source"].includes(n.type)
  );
  const framing = nodes.filter((n) => !claims.includes(n) && !evidence.includes(n));
  return {
    sections: [
      {
        heading: "Introduction",
        purpose: "Open with the guiding question and stakes.",
        nodeRefs: [...framing.slice(0, 2)].map((n) => n.id),
      },
      {
        heading: claims.length > 0 ? "The central claims" : "Key material",
        purpose: "State the claims this essay argues, with their strongest support.",
        nodeRefs: claims.map((n) => n.id),
      },
      {
        heading: "Evidence and examples",
        purpose: "Ground the claims in concrete excerpts.",
        nodeRefs: evidence.map((n) => n.id),
      },
      {
        heading: "Remaining threads",
        purpose: "Fold in notes, questions, and tasks that did not fit above.",
        nodeRefs: [...framing.slice(2), ...nodes.filter((n) => !framing.includes(n) && !claims.includes(n) && !evidence.includes(n))].map((n) => n.id),
      },
    ].filter((section) => section.nodeRefs.length > 0),
  };
}

export function parseMockOutline(raw: unknown): MockOutlineSection[] {
  if (
    raw &&
    typeof raw === "object" &&
    "sections" in raw &&
    Array.isArray((raw as { sections: unknown }).sections)
  ) {
    return (raw as { sections: MockOutlineSection[] }).sections.filter(
      (s) =>
        s &&
        typeof s.heading === "string" &&
        typeof s.purpose === "string" &&
        Array.isArray(s.nodeRefs)
    );
  }
  throw new Error("Malformed outline payload");
}
