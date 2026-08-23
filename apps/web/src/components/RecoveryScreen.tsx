"use client";

import { useEffect, useState } from "react";
import { listVersions, getVersion, type VersionRecord } from "../state/idb";
import { loadRawProjectJson } from "../state/persistence";
import { useStore } from "../state/store";

export function RecoveryScreen({ reason }: { reason: string }) {
  const seedDemoProject = useStore((s) => s.seedDemoProject);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void listVersions(25).then(setVersions).catch(() => setVersions([]));
  }, []);

  const tryRestore = async (id: number | undefined) => {
    if (id === undefined) return;
    const record = await getVersion(id);
    if (record && loadRawProjectJson(record.json)) return;
    setMessage("That version could not be loaded.");
  };

  return (
    <div className="bw-boot bw-recovery">
      <h2>Your saved project couldn&apos;t be loaded</h2>
      <p className="bw-reason">{reason}</p>
      <p>
        Nothing has been overwritten. The unreadable copy is preserved in IndexedDB
        (<code>branchwork → meta → quarantine</code>), and version snapshots below are intact.
      </p>

      <h3>Version history</h3>
      {versions.length === 0 && (
        <p className="bw-muted">No version snapshots exist yet.</p>
      )}
      <ul className="bw-backup-list">
        {versions.map((v) => (
          <li key={v.id}>
            <button className="btn btn-small" onClick={() => void tryRestore(v.id)}>
              Restore
            </button>{" "}
            {new Date(v.savedAt).toLocaleString()} — {v.nodeCount} cards · {v.label}
          </li>
        ))}
      </ul>

      {message && <p className="bw-warn">{message}</p>}

      <div className="bw-recovery-foot">
        <p className="bw-muted">
          Advanced: DevTools → Application → IndexedDB → branchwork → versions holds every
          snapshot as JSON you can export by hand.
        </p>
        <button className="btn" onClick={() => seedDemoProject()}>
          Discard and open demo project
        </button>
      </div>
    </div>
  );
}
