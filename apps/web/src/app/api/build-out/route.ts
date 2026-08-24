import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";

const execAsync = promisify(exec);

interface DdgResult {
  title: string;
  url: string;
  snippet: string;
}

function parseDdgrOutput(output: string): DdgResult[] {
  const results: DdgResult[] = [];
  const lines = output.split("\n");
  let i = 0;
  while (i < lines.length) {
    const currentLine = lines[i] ?? "";
    const entryMatch = /^\s*\d+\.\s+(.+)\s+\[(.+)\]\s*$/.exec(currentLine);
    if (!entryMatch?.[1] || !entryMatch?.[2]) { i++; continue; }

    const title = entryMatch[1].replace(/\s+/g, " ").trim();
    const domain = entryMatch[2].trim();

    // collect subsequent lines as snippet until blank line or next entry
    i++;
    let url = "";
    const snippetParts: string[] = [];
    while (i < lines.length) {
      const l: string = lines[i] ?? "";
      if (/^\s*\d+\.\s/.test(l)) break; // next entry
      if (/^https?:\/\//.test(l.trim())) { url = l.trim(); }
      else if (l.trim()) snippetParts.push(l.trim());
      i++;
    }
    if (!url) url = "https://" + domain;
    results.push({ title, url, snippet: snippetParts.join(" ") });
  }
  return results;
}

async function runDdgr(query: string, count: number): Promise<DdgResult[]> {
  console.log("[build-out-api] running ddgr for:", query);
  try {
    const { stdout } = await execAsync(
      `ddgr --np -n ${count} ${JSON.stringify(query)}`,
      { timeout: 15_000 }
    );
    const parsed = parseDdgrOutput(String(stdout));
    return parsed;
  } catch (error) {
    const errMsg = String((error as Error).message ?? "unknown").slice(0, 300);
    require("fs").appendFileSync("/tmp/ddgr-debug.log", "ERROR: " + errMsg + "\n");
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const { queries } = await request.json() as { queries?: string[][] };
    if (!Array.isArray(queries)) {
      return NextResponse.json({ error: "Expected queries array" }, { status: 400 });
    }

    const allResults: Array<DdgResult & { query: string; cardType: string }> = [];
    for (const [query, cardType] of queries.slice(0, 5)) {
      if (typeof query !== "string" || !query.trim()) continue;
      const results = await runDdgr(query, 3);
      for (const r of results) {
        allResults.push({ ...r, query, cardType: cardType || "source" });
      }
    }

    return NextResponse.json({ results: allResults });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
