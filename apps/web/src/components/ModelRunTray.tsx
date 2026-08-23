"use client";

import { MODEL_ROLE_LABELS } from "@branchwork/domain";
import { useStore } from "../state/store";

export function ModelRunTray() {
  const runs = useStore((s) => s.runs);
  const streamingRunIds = useStore((s) => s.streamingRunIds);
  const cancelRun = useStore((s) => s.cancelRun);

  const visible = Object.values(runs)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  if (visible.length === 0) return null;

  return (
    <div className="bw-run-tray">
      <div className="bw-run-tray-title">Model runs</div>
      {visible.map((run) => {
        const streaming = streamingRunIds.includes(run.id);
        return (
          <div key={run.id} className={`bw-run bw-run-${run.status}`}>
            <span className="bw-run-role">{MODEL_ROLE_LABELS[run.role]}</span>
            <span className="bw-run-status">
              {streaming
                ? "streaming…"
                : run.status === "completed"
                  ? `done · ${run.inputTokens ?? "?"}→${run.outputTokens ?? "?"} tok`
                  : run.status}
            </span>
            {streaming && (
              <button className="bw-mini-btn" onClick={() => cancelRun(run.id)}>
                stop
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
