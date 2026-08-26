"use client";

import { useEffect, useState } from "react";
import { listSaves, sanitizeSaveName } from "../state/fileProject";
import { useStore } from "../state/store";

/**
 * File → New… dialog. Asks for a save-folder name so the current project
 * stays intact in its own folder; the blank slate gets checkpointed into
 * the new one.
 */
export function NewProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  /** performs the create; resolves with the clean name actually used */
  onCreate: (name: string) => Promise<string>;
}) {
  const showToast = useStore((s) => s.showToast);
  const [saves, setSaves] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listSaves().then(setSaves).catch(() => setSaves([]));
  }, []);

  const clean = sanitizeSaveName(name);
  const collides = saves.includes(clean);

  const doCreate = async () => {
    if (busy || !clean) return;
    setBusy(true);
    try {
      const created = await onCreate(clean);
      showToast(`New project started in “${created}”.`);
      onClose();
    } catch (error) {
      showToast(`Could not create project: ${(error as Error).message}`);
      setBusy(false);
    }
  };

  return (
    <div className="bw-modal-backdrop" onClick={onClose}>
      <div className="bw-modal bw-modal-narrow" onClick={(e) => e.stopPropagation()}>
        <header className="bw-modal-header">
          <h2>New project</h2>
          <button className="bw-mini-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </header>
        <p className="bw-modal-sub">
          Starts a fresh canvas with a single opening-question card. Your current
          project stays safe in its own save folder — switch back any time via
          File → Save as / switch save.
        </p>

        <div className="bw-save-new">
          <label className="bw-field bw-field-grow">
            Name for the new project&apos;s save folder
            <input
              value={name}
              autoFocus
              placeholder="e.g. lysenko-notes"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  onClose();
                } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  void doCreate();
                }
              }}
            />
          </label>
        </div>
        {collides && (
          <p className="bw-newproject-warn">
            “{clean}” already exists — creating will overwrite that folder&apos;s project file
            (its version history is kept).
          </p>
        )}

        <footer className="bw-modal-footer">
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <span className="bw-spacer" />
          <button
            className={`btn ${collides ? "" : "btn-primary"}`}
            disabled={busy || !clean}
            title={clean ? `Create “${clean}”` : "Enter a name first"}
            onClick={() => void doCreate()}
          >
            {collides ? "Overwrite & create" : "✚ Create project"}
          </button>
        </footer>
      </div>
    </div>
  );
}
