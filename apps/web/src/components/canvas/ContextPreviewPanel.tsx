"use client";

import { useMemo } from "react";
import { ROLE_PRESETS } from "@branchwork/models";
import { assembleContext, formatContext, estimateTokens } from "@branchwork/graph";
import { useStore } from "../../state/store";

export function ContextPreviewPanel() {
  const preview = useStore((s) => s.contextPreview);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const update = useStore((s) => s.updateContextPreview);
  const close = useStore((s) => s.closeContextPreview);
  const runExploration = useStore((s) => s.runExploration);

  const manifest = useMemo(() => {
    if (!preview || !nodes[preview.focalNodeId]) return null;
    return assembleContext(
      {
        focalNodeIds: [preview.focalNodeId],
        mode: preview.mode,
        tokenBudget: preview.tokenBudget,
      },
      { nodes: Object.values(nodes), edges: Object.values(edges) }
    );
  }, [preview, nodes, edges]);

  if (!preview) return null;
  const focal = nodes[preview.focalNodeId];
  if (!focal) return null;

  return (
    <div className="bw-modal-backdrop" onClick={close}>
      <div className="bw-modal" onClick={(e) => e.stopPropagation()}>
        <header className="bw-modal-header">
          <h2>Explore from here</h2>
          <button className="bw-mini-btn" onClick={close} title="Close (Esc)">
            ✕
          </button>
        </header>

        <p className="bw-modal-sub">
          <strong>{focal.title || focal.plainText.slice(0, 80) || "Untitled card"}</strong>
        </p>

        <div className="bw-controls-row">
          <label>
            Role
            <select
              value={preview.role}
              onChange={(e) => update({ role: e.target.value as typeof preview.role })}
            >
              {(Object.keys(ROLE_PRESETS) as (keyof typeof ROLE_PRESETS)[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_PRESETS[role].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scope
            <select
              value={preview.mode}
              onChange={(e) => update({ mode: e.target.value as typeof preview.mode })}
            >
              <option value="local">Local — this card only</option>
              <option value="branch">Branch — card + ancestors</option>
              <option value="evidence">Evidence — branch + excerpts</option>
            </select>
          </label>
          <label>
            Budget
            <select
              value={preview.tokenBudget}
              onChange={(e) => update({ tokenBudget: Number(e.target.value) })}
            >
              <option value={2000}>~2k tokens</option>
              <option value={4000}>~4k tokens</option>
              <option value={6000}>~6k tokens</option>
              <option value={12000}>~12k tokens</option>
            </select>
          </label>
        </div>

        {manifest && (
          <>
            <p className={`bw-manifest-summary ${manifest.truncated ? "bw-warn" : ""}`}>
              {manifest.items.length} card{manifest.items.length === 1 ? "" : "s"} · ~
              {manifest.estimatedTokens.toLocaleString()} tokens
              {manifest.truncated ? " · trimmed to budget" : ""}
            </p>
            <div className="nowheel bw-manifest-list">
              {manifest.items.map((item) => (
                <div key={item.nodeId} className={`bw-manifest-item bw-role-${item.role}`}>
                  <code>{item.header}</code>
                  <span>{item.body.split("\n")[0]?.slice(0, 110)}</span>
                </div>
              ))}
              {manifest.items.length === 0 && (
                <p className="bw-muted">No cards in scope. Widen the scope or pin material.</p>
              )}
            </div>
            <details className="bw-raw-context">
              <summary>Raw context sent to the model</summary>
              <pre className="nowheel">{formatContext(manifest)}</pre>
            </details>
          </>
        )}

        <footer className="bw-modal-footer">
          <span className="bw-muted">Provider: Branchwork mock (offline)</span>
          <div className="bw-spacer" />
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!manifest || manifest.items.length === 0}
            onClick={() => void runExploration()}
          >
            Generate ✦
          </button>
        </footer>
        <p className="bw-hint">
          Estimated cost: {manifest ? estimateTokens(formatContext(manifest)) : 0} token-units · nothing is
          sent beyond this manifest.
        </p>
      </div>
    </div>
  );
}
