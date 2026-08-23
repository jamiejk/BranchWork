"use client";

import { useEffect, useState } from "react";
import { listVersions, getVersion, type VersionRecord } from "../state/idb";
import { checkpoint, getCurrentSave, loadRawProjectJson } from "../state/persistence";
import { useStore } from "../state/store";

export function VersionsModal({ onClose }: { onClose: () => void }) {
  const showToast = useStore((s) => s.showToast);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const currentJson = useStore((s) => s.exportBundleJson)();

  const saveScope = getCurrentSave();
  const refresh = () =>
    void listVersions(25, saveScope).then(setVersions).catch(() => setVersions([]));
  useEffect(refresh, []);

  const restore = async (id: number | undefined) => {
    if (id === undefined) return;
    setBusyId(id);
    const record = await getVersion(id);
    if (!record) {
      showToast("That version could not be restored.");
      setBusyId(null);
      return;
    }
    if (record.json === currentJson) {
      showToast("You're already on this version.");
      setBusyId(null);
      return;
    }
    if (loadRawProjectJson(record.json)) {
      showToast("Version restored — autosave keeps it as the current state.");
      onClose();
    } else {
      showToast("That version could not be restored.");
      setBusyId(null);
    }
  };

  return (
    <div className="bw-modal-backdrop" onClick={onClose}>
      <div className="bw-modal bw-modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="bw-modal-header">
          <h2>Version history</h2>
          <button className="bw-mini-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </header>
        <p className="bw-modal-sub">
          Snapshots live in this browser&apos;s IndexedDB. Autosaves land roughly every 90 seconds
          while you work; checkpoints are instant.
        </p>

        <footer className="bw-modal-footer" style={{ justifyContent: "flex-start" }}>
          <button
            className="btn btn-small"
            onClick={() => {
              checkpoint("Manual checkpoint");
              setTimeout(refresh, 400);
            }}
          >
            📌 Checkpoint now
          </button>
          <span className="bw-spacer" />
        </footer>

        {versions.length === 0 ? (
          <p className="bw-muted">No versions yet — make a change or add a checkpoint.</p>
        ) : (
      <ul className="bw-backup-list">
        {versions.map((v, i) => (
          <li key={v.id}>
            <button
              className="btn btn-small"
              disabled={busyId === v.id}
              onClick={() => void restore(v.id)}
            >
              Restore
            </button>{" "}
            {new Date(v.savedAt).toLocaleString()} — {v.nodeCount} cards · {v.label}
            {i === 0 && v.json === currentJson ? " · (current)" : ""}
          </li>
        ))}
      </ul>
        )}

        <footer className="bw-modal-footer">
          <span className="bw-muted">Older snapshots are pruned automatically (keep 200).</span>
          <span className="bw-spacer" />
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
