"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "../state/store";
import {
  checkpoint,
  downloadProjectJson,
  getCurrentSave,
  importProjectJson,
  reconnectDiskFile,
  hasLinkedDiskFile,
} from "../state/persistence";
import { diskLinkSupported, linkToDiskFile } from "../state/fileProject";
import { ModelSettingsModal } from "./ModelSettingsModal";
import { VersionsModal } from "./VersionsModal";
import { SaveModal } from "./SaveModal";
import { FileMenu, type FileMenuItem } from "./FileMenu";

export function TopBar() {
  const title = useStore((s) => s.project.title);
  const setTitle = useStore((s) => s.setProjectTitle);
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const layoutSelection = useStore((s) => s.layoutSelection);
  const showToast = useStore((s) => s.showToast);
  const modelSettings = useStore((s) => s.modelSettings);
  const setActiveModel = useStore((s) => s.setActiveModel);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [currentSave, setCurrentSave] = useState("");
  const [diskFile, setDiskFile] = useState<{ name: string; needsPermission: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void hasLinkedDiskFile().then(setDiskFile).catch(() => setDiskFile(null));
    // pick up the active save name once boot has resolved it
    const tick = () => setCurrentSave(getCurrentSave());
    const t = setInterval(tick, 800);
    tick();
    return () => clearInterval(t);
  }, []);

  // Ctrl+H (from the keyboard-shortcut hook) asks the store to open Versions
  useEffect(() => {
    const openVersions = () => setVersionsOpen(true);
    document.addEventListener("bw:versions-open", openVersions);
    return () => document.removeEventListener("bw:versions-open", openVersions);
  }, []);

  const activeModel =
    modelSettings.models.find((m) => m.id === modelSettings.activeModelId) ?? null;
  const activeProvider = activeModel
    ? modelSettings.providers.find((p) => p.id === activeModel.providerId)
    : null;
  const modelConfigured = Boolean(activeProvider?.baseURL && activeProvider?.apiKey);

  const linkDisk = async () => {
    try {
      const name = await linkToDiskFile();
      if (name) {
        setDiskFile({ name, needsPermission: false });
        showToast(`Autosaving to ${name}`);
        checkpoint("Linked to disk file");
      }
    } catch {
      // user cancelled the picker
    }
  };

  const reconnectDisk = async () => {
    const ok = await reconnectDiskFile();
    if (ok && diskFile) {
      setDiskFile({ ...diskFile, needsPermission: false });
      showToast(`Reconnected to ${diskFile.name}`);
      checkpoint("Reconnected disk file");
    }
  };

  const fileItems: FileMenuItem[] = [
    {
      id: "save",
      label: "Save",
      hint: `Checkpoint to “${currentSave || "…"}”`,
      shortcut: "Ctrl+S",
      onSelect: () => {
        checkpoint("Manual save");
        showToast(`Saved to “${currentSave}” ✓`);
      },
    },
    {
      id: "save-as",
      label: "Save as / switch save…",
      hint: currentSave ? `Active save: ${currentSave}` : undefined,
      onSelect: () => setSaveOpen(true),
    },
    {
      id: "versions",
      label: "Version history…",
      shortcut: "Ctrl+H",
      onSelect: () => setVersionsOpen(true),
    },
    {
      id: "disk",
      label:
        diskFile?.needsPermission
          ? `Reconnect ${diskFile.name}`
          : diskFile
            ? `Autosave file: ${diskFile.name}`
            : "Link to disk file…",
      hint:
        diskFile && !diskFile.needsPermission
          ? "Autosave is writing to this file"
          : "Mirror autosaves to a .json on your disk",
      dividerAbove: true,
      disabled: Boolean(diskFile && !diskFile.needsPermission) || (!diskFile && !diskLinkSupported()),
      onSelect: () =>
        void (diskFile?.needsPermission ? reconnectDisk() : linkDisk()),
    },
    {
      id: "export",
      label: "Export JSON…",
      hint: "Download a portable copy of this project",
      shortcut: "Ctrl+E",
      dividerAbove: true,
      onSelect: () => downloadProjectJson(),
    },
    {
      id: "import",
      label: "Import JSON…",
      hint: "Load a Branchwork project file into the canvas",
      onSelect: () => fileInputRef.current?.click(),
    },
  ];

  return (
    <header className="bw-topbar">
      <div className="bw-brand" title="Branchwork — nonlinear thinking upstream, linear writing downstream">
        <span className="bw-brand-mark">⑂</span> Branchwork
      </div>
      <input
        className="bw-project-title"
        value={title}
        placeholder="Untitled project"
        onChange={(e) => setTitle(e.target.value)}
      />
      <nav className="bw-tabs">
        <button
          className={`bw-tab ${activeTab === "canvas" ? "bw-tab-active" : ""}`}
          onClick={() => setActiveTab("canvas")}
        >
          Canvas
        </button>
        <button
          className={`bw-tab ${activeTab === "manuscript" ? "bw-tab-active" : ""}`}
          onClick={() => setActiveTab("manuscript")}
        >
          Manuscript
        </button>
      </nav>
      <div className="bw-spacer" />
      <div className="bw-topbar-actions">
        <label className="bw-model-picker" title="Model used for exploration and drafting">
          <span className="bw-model-picker-label">✦</span>
          <select
            value={activeModel?.id ?? ""}
            onChange={(e) => setActiveModel(e.target.value || null)}
          >
            <option value="">Mock (offline)</option>
            {modelSettings.models.map((m) => {
              const provider = modelSettings.providers.find((p) => p.id === m.providerId);
              const ready = provider?.baseURL && provider?.apiKey ? "" : " (needs key)";
              return (
                <option key={m.id} value={m.id}>
                  {(provider?.label || "Custom") + " · " + (m.modelId || "unnamed") + ` [${m.effort}]` + ready}
                </option>
              );
            })}
          </select>
          {!modelConfigured && (
            <button className="btn btn-small" onClick={() => setModelsOpen(true)}>
              Models…
            </button>
          )}
        </label>
        <button className="btn btn-small" onClick={() => setModelsOpen(true)} title="Configure providers, keys and endpoints">
          ⚙ Models
        </button>
        {diskFile?.needsPermission && (
          <button
            className="btn btn-small bw-disk-reconnect"
            title={`Reconnect ${diskFile.name} to resume autosave to it`}
            onClick={() => void reconnectDisk()}
          >
            🔗 Reconnect {diskFile.name}
          </button>
        )}
        <FileMenu items={fileItems} />
        <button className="btn btn-small" onClick={undo} title="Undo (Ctrl/⌘+Z)">
          ↺
        </button>
        <button className="btn btn-small" onClick={redo} title="Redo (Ctrl/⌘+Shift+Z)">
          ↻
        </button>
        <button
          className="btn btn-small"
          onClick={layoutSelection}
          title="Lay out selected branch (Ctrl/⌘+L)"
        >
          ⌗ Layout branch
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const ok = await importProjectJson(file);
            showToast(ok ? "Project imported." : "Import failed: not a valid Branchwork file.");
            e.target.value = "";
          }}
        />
      </div>
      {modelsOpen && <ModelSettingsModal onClose={() => setModelsOpen(false)} />}
      {versionsOpen && (
        <VersionsModal
          onClose={() => {
            setVersionsOpen(false);
          }}
        />
      )}
      {saveOpen && (
        <SaveModal
          onClose={() => {
            setCurrentSave(getCurrentSave());
            setSaveOpen(false);
          }}
        />
      )}
    </header>
  );
}
