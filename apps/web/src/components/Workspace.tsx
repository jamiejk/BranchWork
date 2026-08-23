"use client";

import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import {
  useAutosave,
  bootProject,
  saveNow,
  type BootStatus,
} from "../state/persistence";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { TopBar } from "./TopBar";
import { CanvasView } from "./canvas/CanvasView";
import { ManuscriptView } from "./manuscript/ManuscriptView";
import { InspectorPanel } from "./InspectorPanel";
import { RecoveryScreen } from "./RecoveryScreen";

export function Workspace() {
  const activeTab = useStore((s) => s.activeTab);
  const toast = useStore((s) => s.toast);
  const loaded = useStore((s) => s.loaded);
  const seedDemoProject = useStore((s) => s.seedDemoProject);
  const [booting, setBooting] = useState(true);
  const [bootStatus, setBootStatus] = useState<BootStatus | null>(null);

  useAutosave();
  useKeyboardShortcuts();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      useStore.getState().hydrateModelSettings();
      const status = await bootProject();
      if (cancelled) return;
      if (status.kind === "fresh") {
        seedDemoProject();
        // persist the demo immediately so the project file exists from day one
        setTimeout(() => saveNow({ checkpoint: true, label: "Initial" }), 100);
      }
      setBootStatus(status.kind === "corrupt" ? status : null);
      setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [seedDemoProject]);

  if (booting) {
    return <div className="bw-boot">Loading Branchwork…</div>;
  }

  if (!loaded && bootStatus?.kind === "corrupt") {
    return <RecoveryScreen reason={bootStatus.reason} />;
  }

  if (!loaded) {
    return <div className="bw-boot">Loading Branchwork…</div>;
  }

  return (
    <div className="bw-workspace">
      <TopBar />
      <div className="bw-main">
        <section className={`bw-pane ${activeTab === "canvas" ? "" : "bw-pane-off"}`}>
          <CanvasView />
        </section>
        <section className={`bw-pane ${activeTab === "manuscript" ? "" : "bw-pane-off"}`}>
          <ManuscriptView />
        </section>
        <InspectorPanel />
      </div>
      {toast && <div className="bw-toast">{toast}</div>}
    </div>
  );
}
