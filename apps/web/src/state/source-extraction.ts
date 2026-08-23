"use client";

// Post-stream source extraction: after an exploration completes, ask the model
// once (JSON mode) to list every source it referenced, then materialise each
// one as a `source` node wired to the card with a `cites` edge.

import type { ResearchNode } from "@branchwork/domain";
import type { ModelSettings } from "./modelSettings";
import { resolveExtraction, OPENAI_COMPAT_ID } from "./generation";

export const MAX_SOURCES_PER_RUN = 6;
export const MAX_ENTITIES_PER_RUN = 5;

export interface ExtractedSource {
  title: string;
  url: string;
}

interface RawExtraction {
  sources?: unknown;
}

export const EXTRACTION_PROMPT = [
  "List every external source (URL or publication) referenced in the text below.",
  'Respond with JSON: {"sources": [{"title": "...", "url": "..."}]}.',
  "Include only sources actually cited or linked. If there are none, respond with an empty list.",
  "Never invent sources.",
].join(" ");

export const ENTITY_PROMPT = [
  "Extract the key entities from the text below: people, organisations, works, technologies, events, and core concepts.",
  'Respond with JSON: {"entities": [{"name": "...", "kind": "person|organisation|work|technology|event|concept"}]}.',
  `At most ${MAX_ENTITIES_PER_RUN} entries, most important first. Use short canonical names.`,
  "If there are none, respond with an empty list.",
].join(" ");

/** Lenient parser for the model's JSON reply; accepts a bare array too. */
export function parseExtractedSources(raw: unknown): ExtractedSource[] {
  let list: unknown = raw;
  if (raw && typeof raw === "object" && "sources" in raw) {
    list = (raw as RawExtraction).sources;
  }
  if (!Array.isArray(list)) return [];
  const out: ExtractedSource[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const { url, title } = item as Record<string, unknown>;
    if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) continue;
    out.push({
      url: url.trim(),
      title:
        typeof title === "string" && title.trim()
          ? title.trim().slice(0, 110)
          : new URL(url.trim()).hostname.replace(/^www\./, ""),
    });
    if (out.length >= MAX_SOURCES_PER_RUN) break;
  }
  return out;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
}

/** URLs already captured by existing `source` nodes anywhere in the project. */
function knownSourceUrls(nodes: Record<string, ResearchNode>): Set<string> {
  const known = new Set<string>();
  for (const node of Object.values(nodes)) {
    if (node.type !== "source") continue;
    for (const match of node.content.matchAll(/https?:\/\/\S+/g)) {
      known.add(normalizeUrl(match[0]));
    }
  }
  return known;
}

export interface SourcePlanItem {
  title: string;
  url: string;
}

/**
 * Which extracted sources still need a node (deduped against the whole
 * project). Sources that already exist are skipped — callers may link them.
 */
export function planNewSourceNodes(
  nodes: Record<string, ResearchNode>,
  extracted: ExtractedSource[]
): SourcePlanItem[] {
  const known = knownSourceUrls(nodes);
  const seen = new Set<string>();
  const plan: SourcePlanItem[] = [];
  for (const source of extracted) {
    const key = normalizeUrl(source.url);
    if (known.has(key) || seen.has(key)) continue;
    seen.add(key);
    plan.push({ title: source.title, url: source.url });
  }
  return plan;
}

/** Satellite lane placement: left of the parent, stacked vertically. */
export function sourceNodePosition(
  parent: ResearchNode,
  index: number
): { x: number; y: number } {
  const width = parent.size?.width ?? 280;
  return {
    x: parent.position.x - width - 140,
    y: parent.position.y + index * 150,
  };
}

/** Guard: extraction is only meaningful against a real configured provider. */
export function extractionConfigured(settings: ModelSettings): boolean {
  return resolveExtraction(settings)?.adapterId === OPENAI_COMPAT_ID;
}

export interface ExtractedEntity {
  name: string;
  kind: string;
}

const ENTITY_KINDS = new Set(["person", "organisation", "work", "technology", "event", "concept"]);

export function parseExtractedEntities(raw: unknown): ExtractedEntity[] {
  let list: unknown = raw;
  if (raw && typeof raw === "object" && "entities" in raw) {
    list = (raw as { entities?: unknown }).entities;
  }
  if (!Array.isArray(list)) return [];
  const out: ExtractedEntity[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const { name, kind } = item as Record<string, unknown>;
    if (typeof name !== "string" || name.trim().length < 2) continue;
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: name.trim().slice(0, 80),
      kind: typeof kind === "string" && ENTITY_KINDS.has(kind.toLowerCase()) ? kind.toLowerCase() : "concept",
    });
    if (out.length >= MAX_ENTITIES_PER_RUN) break;
  }
  return out;
}

/** Entities that don't already exist as cards (case-insensitive title match). */
export function planNewEntityNodes(
  nodes: Record<string, ResearchNode>,
  entities: ExtractedEntity[]
): ExtractedEntity[] {
  const titles = new Set(
    Object.values(nodes)
      .map((n) => n.title.trim().toLowerCase())
      .filter(Boolean)
  );
  return entities.filter((e) => !titles.has(e.name.trim().toLowerCase()));
}
