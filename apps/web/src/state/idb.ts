"use client";

// Tiny promise wrapper over IndexedDB. Two stores:
//   versions : append-only project snapshots, tagged with the save they belong to
//   meta     : key/value records (current save, quarantined bundles, disk-link)

const DB_NAME = "branchwork";
const DB_VERSION = 3;

export interface VersionRecord {
  id?: number;
  savedAt: string;
  nodeCount: number;
  label: string;
  json: string;
  /** which named save this snapshot belongs to ("test", "my-essay", …) */
  saveName: string;
}

export async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // every store is ensured independently — never couple them
      if (!db.objectStoreNames.contains("versions")) {
        const store = db.createObjectStore("versions", { keyPath: "id", autoIncrement: true });
        store.createIndex("savedAt", "savedAt");
        store.createIndex("saveName", "saveName");
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      })
  );
}

export async function addVersion(
  json: string,
  nodeCount: number,
  label: string,
  saveName: string
): Promise<number> {
  const record: Omit<VersionRecord, "id"> = {
    savedAt: new Date().toISOString(),
    nodeCount,
    label,
    json,
    saveName,
  };
  return tx("versions", "readwrite", (s) => s.add(record) as unknown as IDBRequest<number>);
}

export async function listVersions(limit = 25, saveName?: string): Promise<VersionRecord[]> {
  const all = await tx<VersionRecord[]>("versions", "readonly", (s) => s.getAll() as unknown as IDBRequest<VersionRecord[]>);
  const filtered = saveName ? all.filter((v) => v.saveName === saveName || !v.saveName) : all;
  return filtered.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1)).slice(0, limit);
}

export async function getVersion(id: number): Promise<VersionRecord | undefined> {
  return tx<VersionRecord | undefined>("versions", "readonly", (s) => s.get(id));
}

export async function countVersions(): Promise<number> {
  return tx<number>("versions", "readonly", (s) => s.count());
}

/** Keep the newest `keep` versions per save; delete older ones. */
export async function pruneVersions(keep = 200, saveName?: string): Promise<number> {
  const all = await tx<VersionRecord[]>("versions", "readonly", (s) => s.getAll() as unknown as IDBRequest<VersionRecord[]>);
  const scoped = saveName ? all.filter((v) => v.saveName === saveName || !v.saveName) : all;
  if (scoped.length <= keep) return 0;
  const sorted = scoped.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  const doomedIds = new Set(sorted.slice(keep).map((r) => r.id).filter((id): id is number => typeof id === "number"));
  const db = await openDb();
  const deleted = await new Promise<number>((resolve, reject) => {
    const transaction = db.transaction("versions", "readwrite");
    const store = transaction.objectStore("versions");
    for (const id of doomedIds) store.delete(id);
    transaction.oncomplete = () => resolve(doomedIds.size);
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  return deleted;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await tx("meta", "readwrite", (s) => s.put({ key, value }) as unknown as IDBRequest);
}

export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const record = await tx<{ key: string; value: T } | undefined>("meta", "readonly", (s) => s.get(key));
  return record?.value;
}
