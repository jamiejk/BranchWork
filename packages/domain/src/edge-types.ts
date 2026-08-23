import { z } from "zod";

export const EDGE_TYPES = [
  "branches_from",
  "supports",
  "contradicts",
  "qualifies",
  "defines",
  "exemplifies",
  "derived_from",
  "cites",
  "compares_with",
  "related_to",
  "included_in",
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

export const edgeTypeSchema = z.enum(EDGE_TYPES);

export const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  branches_from: "branches from",
  supports: "supports",
  contradicts: "contradicts",
  qualifies: "qualifies",
  defines: "defines",
  exemplifies: "exemplifies",
  derived_from: "derived from",
  cites: "cites",
  compares_with: "compares with",
  related_to: "related to",
  included_in: "included in",
};

export const EDGE_CREATORS = ["human", "model", "system"] as const;

export type EdgeCreator = (typeof EDGE_CREATORS)[number];

export const edgeCreatorSchema = z.enum(EDGE_CREATORS);
