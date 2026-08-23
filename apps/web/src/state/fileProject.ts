"use client";

// Project file storage.
//
// Layout inside the origin's private filesystem (OPFS):
//   saves/<name>/project.branchwork.json   — one folder per named save
//
// The active save is tracked in IndexedDB meta ("currentSave"). Optional
// disk-file linking (File System Access API) mirrors autosaves to a real
// user-owned file where supported.

const PROJECT_FILE = "project.branchwork.json";
const SAVES_DIR = "saves";
export const DEFAULT_SAVE_NAME = "test";

export function opfsAvailable(): boolean {
  return typeof navigator !== "undefined" && "storage" in navigator && "getDirectory" in navigator.storage;
}

export function diskLinkSupported(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

/** User-typed names become safe single folder segments. */
export function sanitizeSaveName(input: string): string {
  const cleaned = input
    .trim()
    .replace(/[\\/:*?"<>|.#]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 60);
  return cleaned || DEFAULT_SAVE_NAME;
}

async function savesDir(create = true): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(SAVES_DIR, { create });
}

async function saveFileHandle(name: string): Promise<FileSystemFileHandle> {
  const dir = await savesDir(true);
  const folder = await dir.getDirectoryHandle(sanitizeSaveName(name), { create: true });
  return folder.getFileHandle(PROJECT_FILE, { create: true });
}

/** All named saves that actually contain a project file.
 *  Primary source: the registry in IndexedDB (deterministic). Enumeration of
 *  the OPFS folder is merged in as a fallback because Chromium's directory
 *  iteration can transiently miss entries right after writes.
 */
export async function listSaves(): Promise<string[]> {
  const { getMeta } = await import("./idb");
  const registered = await getMeta<string[]>("saveList").catch(() => undefined);
  const names = new Set<string>((registered ?? []).map((n) => sanitizeSaveName(n)));
  try {
    const dir = await savesDir(false);
    const iterator = (dir as unknown as {
      entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    }).entries();
    for await (const [name, handle] of iterator) {
      if (handle.kind !== "directory") continue;
      try {
        await (handle as FileSystemDirectoryHandle).getFileHandle(PROJECT_FILE);
        names.add(sanitizeSaveName(name));
      } catch {
        // folder without a project file: ignore
      }
    }
  } catch {
    // enumeration failed or no saves dir yet — registry still stands
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Remember a save name so listing stays reliable across OPFS quirks. */
export async function registerSaveName(name: string): Promise<void> {
  const clean = sanitizeSaveName(name);
  const existing = new Set(await listSaves());
  existing.add(clean);
  const { setMeta } = await import("./idb");
  await setMeta("saveList", [...existing]);
}

export async function readSaveFile(name: string): Promise<string | null> {
  if (!opfsAvailable()) return null;
  // Chromium quirk: right after a swap-write, another renderer may briefly see
  // a stale directory (NotFoundError). Retry rather than treating it as absent.
  for (let attempt = 0; ; attempt++) {
    try {
      const handle = await saveFileHandle(name);
      const file = await handle.getFile();
      return await file.text();
    } catch (error) {
      if ((error as Error).name === "NotFoundError") {
        if (attempt < 4) {
          await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
          continue;
        }
        return null;
      }
      throw error;
    }
  }
}

export async function writeSaveFile(name: string, json: string): Promise<void> {
  const handle = await saveFileHandle(name);
  const writable = await handle.createWritable();
  await writable.write(json);
  await writable.close();
}

/** One-time move of the pre-folders layout (root project file) into saves/test. */
export async function migrateLegacyRootFile(name = DEFAULT_SAVE_NAME): Promise<boolean> {
  if (!opfsAvailable()) return false;
  try {
    const root = await navigator.storage.getDirectory();
    const legacy = await root.getFileHandle(PROJECT_FILE);
    const text = await (await legacy.getFile()).text();
    await writeSaveFile(name, text);
    await root.removeEntry(PROJECT_FILE);
    return true;
  } catch (error) {
    if ((error as Error).name === "NotFoundError") return false;
    throw error;
  }
}

// ---- optional disk-file link (Chromium; requires user gesture) ----

interface WafsFileHandle extends FileSystemFileHandle {
  queryPermission: (opts: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission: (opts: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
  createWritable: () => Promise<FileSystemWritableFileStream>;
}

interface LinkedHandleMeta {
  name: string;
}

let linkedHandle: WafsFileHandle | null = null;

export function linkedFileName(): string | null {
  return linkedHandle?.name ?? null;
}

/** Open a picker and remember the chosen file. Must be called from a click. */
export async function linkToDiskFile(): Promise<string | null> {
  if (!diskLinkSupported()) return null;
  const picker = (
    window as unknown as {
      showOpenFilePicker: (opts?: unknown) => Promise<WafsFileHandle[]>;
    }
  ).showOpenFilePicker;
  const [handle] = await picker({
    types: [{ description: "Branchwork project", accept: { "application/json": [".json"] } }],
    multiple: false,
  });
  if (!handle) return null;
  linkedHandle = handle;
  const { setMeta } = await import("./idb");
  await setMeta("linkedDiskFile", { name: handle.name } satisfies LinkedHandleMeta);
  await storeLinkedHandle(handle);
  return handle.name;
}

async function storeLinkedHandle(handle: WafsFileHandle): Promise<void> {
  const { setMeta } = await import("./idb");
  await setMeta("linkedDiskHandle", handle); // handles are structured-cloneable
}

/** Restore the linked handle from a previous session, verifying permission. */
export async function restoreLinkedHandle(): Promise<{ name: string; permission: "granted" | "prompt" } | null> {
  try {
    const { getMeta } = await import("./idb");
    const meta = await getMeta<LinkedHandleMeta>("linkedDiskFile");
    const handle = await getMeta<WafsFileHandle>("linkedDiskHandle");
    if (!meta || !handle) return null;
    linkedHandle = handle;
    const perm = await handle.queryPermission({ mode: "readwrite" });
    return { name: meta.name, permission: perm === "granted" ? "granted" : "prompt" };
  } catch {
    return null;
  }
}

export async function ensureLinkedPermission(): Promise<boolean> {
  if (!linkedHandle) return false;
  const perm = await linkedHandle.queryPermission({ mode: "readwrite" });
  if (perm === "granted") return true;
  return (await linkedHandle.requestPermission({ mode: "readwrite" })) === "granted";
}

export async function writeToLinkedDiskFile(json: string): Promise<boolean> {
  if (!linkedHandle) return false;
  const permitted = await ensureLinkedPermission();
  if (!permitted) return false;
  const writable = await linkedHandle.createWritable();
  await writable.write(json);
  await writable.close();
  return true;
}
