"use client";

import { useMemo, useRef } from "react";
import { MODEL_ROLE_LABELS } from "@branchwork/domain";
import { useStore } from "../../state/store";
import { focusNode } from "../../lib/rf";

export function ManuscriptView() {
  const manuscriptId = useStore((s) => s.activeManuscriptId);
  const manuscripts = useStore((s) => s.manuscripts);
  const nodes = useStore((s) => s.nodes);
  const passages = useStore((s) => s.passages);
  const runs = useStore((s) => s.runs);
  const selectedNodeIds = useStore((s) => s.selectedNodeIds);
  const generateOutline = useStore((s) => s.generateOutlineFromSelection);
  const reorderSection = useStore((s) => s.reorderSection);
  const updateHeading = useStore((s) => s.updateSectionHeading);
  const updateDraft = useStore((s) => s.updateSectionDraft);
  const draftSection = useStore((s) => s.draftSection);
  const streamingRunIds = useStore((s) => s.streamingRunIds);
  const exportMarkdownRef = useRef<(() => void) | null>(null);

  const manuscript = manuscriptId ? manuscripts[manuscriptId] : undefined;
  const sections = useMemo(
    () =>
      (manuscript?.outline ?? [])
        .slice()
        .sort((a, b) => a.order - b.order),
    [manuscript?.outline]
  );

  exportMarkdownRef.current = () => {
    if (!manuscript || sections.length === 0) return;
    const lines: string[] = [`# ${manuscript.title}`, ""];
    for (const section of sections) {
      lines.push(`## ${section.heading}`, "");
      if (section.draft) {
        lines.push(section.draft.trim(), "");
      } else {
        lines.push("_Not drafted yet._", "");
      }
      if (section.nodeRefs.length > 0) {
        lines.push(
          `Sources: ${section.nodeRefs
            .map((id) => nodes[id]?.title || id)
            .join("; ")}.`,
          ""
        );
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${manuscript.title.replace(/[^\w-]+/g, "-").toLowerCase()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bw-manuscript">
      <div className="bw-manuscript-toolbar">
        <span className="bw-muted">
          {selectedNodeIds.length} card{selectedNodeIds.length === 1 ? "" : "s"} selected on canvas
        </span>
        <div className="bw-spacer" />
        <button className="btn" onClick={() => void generateOutline()}>
          ✦ Outline from selection
        </button>
        <button
          className="btn"
          disabled={!manuscript || sections.length === 0}
          onClick={() => exportMarkdownRef.current?.()}
        >
          Export Markdown
        </button>
      </div>

      {!manuscript || sections.length === 0 ? (
        <div className="bw-manuscript-empty">
          <h2>No outline yet</h2>
          <p>
            Select cards on the canvas — a claim, an excerpt, a note or two — then press{" "}
            <strong>Outline from selection</strong>. The proposal stays fully editable and every
            section keeps its links back to the research graph.
          </p>
        </div>
      ) : (
        <ol className="bw-outline">
          {sections.map((section, index) => {
            const provenance = passages[`${manuscript!.id}:${section.id}`];
            const run = provenance?.modelRunId ? runs[provenance.modelRunId] : undefined;
            const isStreaming = provenance
              ? streamingRunIds.includes(provenance.modelRunId ?? "")
              : false;
            return (
              <li key={section.id} className="bw-section-card">
                <div className="bw-section-header">
                  <span className="bw-section-index">{index + 1}</span>
                  <input
                    className="bw-section-heading"
                    value={section.heading}
                    onChange={(e) => updateHeading(section.id, e.target.value)}
                  />
                  <button
                    className="bw-mini-btn"
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => reorderSection(section.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="bw-mini-btn"
                    title="Move down"
                    disabled={index === sections.length - 1}
                    onClick={() => reorderSection(section.id, 1)}
                  >
                    ↓
                  </button>
                </div>

                {section.purpose && <p className="bw-purpose">{section.purpose}</p>}

                <div className="bw-ref-chips">
                  {section.nodeRefs.map((ref) => (
                    <button
                      key={ref}
                      className="bw-chip bw-chip-link"
                      title="Reveal this card on the canvas"
                      onClick={() => {
                        useStore.getState().setActiveTab("canvas");
                        setTimeout(() => focusNode(ref), 60);
                      }}
                    >
                      {nodes[ref]?.title || nodes[ref]?.plainText.slice(0, 40) || ref}
                    </button>
                  ))}
                  {section.nodeRefs.length === 0 && (
                    <span className="bw-warn">No referenced cards</span>
                  )}
                </div>

                {section.draft !== undefined && (
                  <textarea
                    className="nowheel bw-draft-editor"
                    value={section.draft}
                    readOnly={isStreaming}
                    onChange={(e) => updateDraft(section.id, e.target.value)}
                    rows={Math.min(20, Math.max(4, Math.ceil(section.draft.length / 90)))}
                  />
                )}

                {provenance && !isStreaming && (
                  <p className="bw-provenance">
                    Drafted from {provenance.nodeIds.length} card(s)
                    {run ? ` · run ${run.role} · ${run.inputTokens ?? "?"}→${run.outputTokens ?? "?"} tok` : ""}
                  </p>
                )}
                {isStreaming && (
                  <p className="bw-provenance">
                    ✦ drafting with {MODEL_ROLE_LABELS.prose_drafter.toLowerCase()}…
                  </p>
                )}

                <div className="bw-section-footer">
                  <button className="btn btn-small" onClick={() => void draftSection(section.id)}>
                    {isStreaming ? "Drafting…" : section.draft ? "Redraft section" : "✦ Draft from these notes"}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
