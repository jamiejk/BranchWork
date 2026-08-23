"use client";

import { useEffect, useState } from "react";
import {
  getCurrentSave,
  saveAs,
  switchToSave,
} from "../state/persistence";
import { listSaves, sanitizeSaveName } from "../state/fileProject";
import { useStore } from "../state/store";

export function SaveModal({ onClose }: { onClose: () => void }) {
  const showToast = useStore((s) => s.showToast);
  const [saves, setSaves] = useState<string[]>([]);
  const [current, setCurrent] = useState(getCurrentSave());
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => void listSaves().then(setSaves).catch(() => setSaves([]));
  useEffect(refresh, []);

  const doSaveAs = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const saved = await saveAs(name || current);
      setCurrent(saved);
      setName("");
      refresh();
      showToast(`Saved to "${saved}". Autosave writes here now.`);
    } catch (error) {
      showToast(`Save failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doSwitch = async (target: string) => {
    if (target === current) return;
    setBusy(true);
    try {
      if (await switchToSave(target)) {
        setCurrent(target);
        refresh();
        showToast(`Switched to "${target}".`);
      } else {
        showToast(`"${target}" could not be loaded.`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bw-modal-backdrop" onClick={onClose}>
      <div className="bw-modal bw-modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="bw-modal-header">
          <h2>Saves</h2>
          <button className="bw-mini-btn" onClick={onClose}>
            ✕
          </button>
        </header>
        <p className="bw-modal-sub">
          Each save is its own folder with its project file and version history.
          Autosave always writes to the active one — currently{" "}
          <strong>“{current}”</strong>.
        </p>

        <ul className="bw-backup-list">
          {saves.map((name) => (
            <li key={name}>
              {name === current ? (
                <>
                  <span className="bw-save-current">● {name}</span>{" "}
                  <span className="bw-muted">(active)</span>
                </>
              ) : (
                <>
                  <button className="btn btn-small" disabled={busy} onClick={() => void doSwitch(name)}>
                    Switch
                  </button>{" "}
                  {name}
                </>
              )}
            </li>
          ))}
          {saves.length === 0 && <li className="bw-muted">No saves yet.</li>}
        </ul>

        <div className="bw-save-new">
          <label className="bw-field bw-field-grow">
            New / existing folder name
            <input
              value={name}
              placeholder='e.g. "test", "lysenko-notes"…'
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) void doSaveAs();
              }}
            />
          </label>
          <button className="btn btn-primary" disabled={busy} onClick={() => void doSaveAs()}>
            💾 Save here
          </button>
        </div>
        <p className="bw-muted">
          Saving to an existing name overwrites its project file with the current canvas
          (its earlier versions stay in history).
        </p>

        <footer className="bw-modal-footer">
          <span className="bw-spacer" />
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
