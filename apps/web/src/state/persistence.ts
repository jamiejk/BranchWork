"use client";

// Project persistence orchestration.
//
//   saves/<name>/project.branchwork.json (OPFS) — one file per named save
//   IndexedDB versions                          — history, scoped per save
//   linked disk file                            — optional user-owned mirror
//   localStorage                                — legacy import + settings only

import { useEffect } from "react";
import { useStore } from "./store";
import {
  addVersion,
  getMeta,
  pruneVersions,
  setMeta,
} from "./idb";
import {
  DEFAULT_SAVE_NAME,
  listSaves as opfsListSaves,
  migrateLegacyRootFile,
  readSaveFile,
  writeSaveFile,
  writeToLinkedDiskFile,
  restoreLinkedHandle,
  ensureLinkedPermission,
  opfsAvailable,
  registerSaveName,
  sanitizeSaveName,
} from "./fileProject";

const VERSION_MIN_INTERVAL_MS = 90_000;
const VERSION_KEEP = 200;

export type BootStatus =
  | { kind: "loaded-save"; save: string }
  | { kind: "fresh" }
  | { kind: "corrupt"; reason: string };

let currentSave = DEFAULT_SAVE_NAME;
let lastVersionAt = 0;
let writeChain: Promise<void> = Promise.resolve();
let pendingForceVersion = false;
/** The exact text of our most recent successful write (or clean load). */
let lastWritten: string | null = null;
/** JSON of the newest stored version, so identical snapshots are skipped. */
let lastSnapshotJson: string | null = null;

export function getCurrentSave(): string {
  return currentSave;
}

export interface RecentSave {
  name: string;
  /** epoch ms of the save's project file last write (0 = registry-only entry) */
  lastModified: number;
  current: boolean;
}

/** Named saves sorted by project-file mtime, newest first (File ▾ "Open recent"). */
export async function listRecentSaves(limit = 6): Promise<RecentSave[]> {
  const { listSavesDetailed } = await import("./fileProject");
  const infos = await listSavesDetailed().catch(() => []);
  return infos
    .slice(0, Math.max(limit, 1))
    .map((info) => ({ ...info, current: info.name === currentSave }));
}

function nodeCountOf(json: string): number {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed.nodes) ? parsed.nodes.length : -1;
  } catch {
    return -1;
  }
}

function currentJson(): string {
  return useStore.getState().exportBundleJson();
}

/** Write-through: the current save's file (+optional disk mirror), plus throttled snapshots. */
export function saveNow(options?: { checkpoint?: boolean; label?: string }): void {
  const forceVersion = Boolean(options?.checkpoint) || pendingForceVersion;
  const label = options?.label ?? (forceVersion ? "Checkpoint" : "Autosave");
  writeChain = writeChain.then(async () => {
    const st = useStore.getState();
    // Never persist pre-boot or bootstrap state — doing so would overwrite
    // real files with an empty project (StrictMode cleanup included).
    if (!st.loaded && !options?.checkpoint) return;
    let json = "";
    let nodeCount = 0;
    try {
      json = currentJson();
      nodeCount = Object.keys(st.nodes).length;
      await writeSaveFile(currentSave, json);
      lastWritten = json;
      void writeToLinkedDiskFile(json).catch(() => {});
    } catch {
      return; // storage hiccup: keep running in memory; next change retries
    }
    const due = Date.now() - lastVersionAt > VERSION_MIN_INTERVAL_MS;
    if (forceVersion || due) {
      pendingForceVersion = false;
      lastVersionAt = Date.now();
      try {
        if (json !== lastSnapshotJson) {
          await addVersion(json, nodeCount, label, currentSave);
          lastSnapshotJson = json;
          void pruneVersions(VERSION_KEEP, currentSave).catch(() => {});
        }
      } catch {
        // history is best-effort
      }
    }
  });
}

/** Manual checkpoint entry point (UI / Ctrl+S). */
export function checkpoint(label?: string): void {
  saveNow({ checkpoint: true, label });
}

/**
 * Boot sequence. Non-destructive by design: unreadable data is quarantined in
 * IndexedDB and reported, never overwritten.
 */
export async function bootProject(): Promise<BootStatus> {
  if (!opfsAvailable()) return { kind: "fresh" };

  await migrateLegacyRootFile(DEFAULT_SAVE_NAME);

  const savedName = await getMeta<string>("currentSave");
  currentSave = typeof savedName === "string" && savedName ? savedName : DEFAULT_SAVE_NAME;

  const raw = await readSaveFile(currentSave);
  if (raw !== null && raw !== "") {
    const result = tryLoad(raw);
    if (result.ok) {
      lastWritten = raw;
      lastSnapshotJson = raw;
      void registerSaveName(currentSave);
      return { kind: "loaded-save", save: currentSave };
    }
    await setMeta("quarantine", { at: new Date().toISOString(), save: currentSave, raw, reason: result.reason });
    return { kind: "corrupt", reason: `Save "${currentSave}" failed to load: ${result.reason}` };
  }

  // no project file for the current save — fall back to any other existing save
  const existing = await opfsListSaves();
  if (existing.length > 0) {
    const fallback = existing.includes(DEFAULT_SAVE_NAME) ? DEFAULT_SAVE_NAME : existing[0]!;
    currentSave = fallback;
    await setMeta("currentSave", fallback);
    const fallbackRaw = await readSaveFile(fallback);
    if (fallbackRaw) {
      const result = tryLoad(fallbackRaw);
      if (result.ok) {
        lastWritten = fallbackRaw;
        lastSnapshotJson = fallbackRaw;
        void registerSaveName(fallback);
        return { kind: "loaded-save", save: fallback };
      }
      await setMeta("quarantine", { at: new Date().toISOString(), save: fallback, raw: fallbackRaw, reason: result.reason });
      return { kind: "corrupt", reason: `Save "${fallback}" failed to load: ${result.reason}` };
    }
  }

  return { kind: "fresh" };
}

function tryLoad(raw: string): { ok: true } | { ok: false; reason: string } {
  try {
    const data = JSON.parse(raw);
    stripLegacySizesOnce(data);
    splitEmbeddedTitlesOnce(data);
    if (useStore.getState().loadFromBundle(data)) return { ok: true };
    return { ok: false, reason: "validation failed" };
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }
}

const SIZE_MIGRATION_KEY = "branchwork.migration.stripLegacySizes";
const TITLE_SPLIT_MIGRATION_KEY = "branchwork.migration.splitTitles";

function stripLegacySizesOnce(data: unknown): void {
  try {
    if (localStorage.getItem(SIZE_MIGRATION_KEY)) return;
    if (data && typeof data === "object" && Array.isArray((data as { nodes?: unknown[] }).nodes)) {
      for (const node of (data as { nodes: unknown[] }).nodes) {
        if (node && typeof node === "object" && "size" in node) {
          delete (node as Record<string, unknown>).size;
        }
      }
    }
    localStorage.setItem(SIZE_MIGRATION_KEY, new Date().toISOString());
  } catch {
    // best-effort
  }
}

/**
 * Titles used to live inside the body (as its first line). Titles are now an
 * independent field, so strip the embedded copy exactly once; afterwards the
 * two never re-merge.
 */
function splitEmbeddedTitlesOnce(data: unknown): void {
  try {
    if (localStorage.getItem(TITLE_SPLIT_MIGRATION_KEY)) return;
    if (data && typeof data === "object" && Array.isArray((data as { nodes?: unknown[] }).nodes)) {
      for (const node of (data as { nodes: Array<Record<string, unknown>> }).nodes) {
        const title = typeof node.title === "string" ? node.title.trim() : "";
        const content = typeof node.content === "string" ? node.content : "";
        if (title && content.startsWith(title)) {
          node.content = content.slice(title.length).replace(/^\s+/, "");
        }
      }
    }
    localStorage.setItem(TITLE_SPLIT_MIGRATION_KEY, new Date().toISOString());
  } catch {
    // best-effort
  }
}

/** Write the live state to a named save folder and make it active. */
export async function saveAs(input: string): Promise<string> {
  const clean = sanitizeSaveName(input);
  const json = currentJson();
  await writeSaveFile(clean, json);
  currentSave = clean;
  lastWritten = json;
  void registerSaveName(clean);
  await setMeta("currentSave", clean);
  await addVersion(json, Object.keys(useStore.getState().nodes).length, `Saved as "${clean}"`, clean);
  lastSnapshotJson = json;
  return clean;
}

/**
 * Start a brand-new project in its own named save folder. The previous save
 * stays untouched on disk, switchable via Save as / switch.
 */
export async function newProject(input?: string): Promise<string> {
  const clean = sanitizeSaveName(
    input && input.trim() ? input : `untitled-${new Date().toISOString().slice(0, 10)}`
  );
  useStore.getState().newEmptyProject();
  currentSave = clean;
  lastWritten = null;
  lastSnapshotJson = null;
  pendingForceVersion = false;
  void registerSaveName(clean);
  await setMeta("currentSave", clean);
  // force-write the blank slate to the new folder (saveNow skips identical
  // snapshots, so a real write needs the forced checkpoint path)
  checkpoint(`New project “${clean}”`);
  return clean;
}

export type SwitchSaveResult = { ok: true } | { ok: false; reason: string };

/** Load a named save's latest file into the store and make it active. */
export async function switchToSave(name: string): Promise<SwitchSaveResult> {
  const raw = await readSaveFile(name).catch(() => null);
  // An empty file means the folder was auto-created on read: this browser
  // has no data for that save. (Storage is scoped per browser + origin, so
  // saves made in another browser or under another host are simply absent.)
  if (raw === null || raw.trim() === "") {
    return {
      ok: false,
      reason: "no data for this save in this browser's storage",
    };
  }
  const result = tryLoad(raw);
  if (!result.ok) return { ok: false, reason: result.reason };
  currentSave = name;
  lastWritten = raw;
  lastSnapshotJson = raw;
  pendingForceVersion = false;
  void registerSaveName(name);
  await setMeta("currentSave", name);
  return { ok: true };
}

export function useAutosave(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => saveNow(), 500);
    };

    const unsub = useStore.subscribe((state, prev) => {
      if (!state.loaded) return;
      if (
        state.nodes !== prev.nodes ||
        state.edges !== prev.edges ||
        state.project !== prev.project ||
        state.manuscripts !== prev.manuscripts ||
        state.passages !== prev.passages ||
        state.runs !== prev.runs
      ) {
        schedule();
      }
    });

    return () => {
      unsub();
      if (timer) clearTimeout(timer);
      saveNow();
    };
  }, []);
}

/** Reconnect a previously linked disk file after a permission prompt gap. */
export async function reconnectDiskFile(): Promise<boolean> {
  const restored = await restoreLinkedHandle();
  if (!restored) return false;
  if (restored.permission === "granted") return true;
  return ensureLinkedPermission();
}

export async function hasLinkedDiskFile(): Promise<{ name: string; needsPermission: boolean } | null> {
  const restored = await restoreLinkedHandle();
  if (!restored) return null;
  return { name: restored.name, needsPermission: restored.permission !== "granted" };
}

export function downloadProjectJson(): void {
  const json = currentJson();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${currentSave}-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Load a raw JSON string (recovery screen / file import). */
export function loadRawProjectJson(text: string): boolean {
  const result = tryLoad(text);
  if (result.ok) {
    saveNow({ checkpoint: true, label: "Restored" });
    return true;
  }
  return false;
}

export async function importProjectJson(file: File): Promise<boolean> {
  return loadRawProjectJson(await file.text());
}
