"use client";

import type { ReactNode } from "react";

// Minimal inline-markdown renderer: **bold**, *italic*, `code`, [text](url).
// Deliberately tiny — model output is conversational prose, not documents.

const INLINE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\([^)\s]+\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("**")) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      out.push(
        <code key={key} className="bw-md-code">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (linkMatch) {
        out.push(
          <a key={key} href={linkMatch[2]} target="_blank" rel="noreferrer" className="bw-md-link" onClick={(e) => e.stopPropagation()}>
            {linkMatch[1]}
          </a>
        );
      } else {
        out.push(token);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim() !== "");
  return (
    <>
      {blocks.map((block, bi) => (
        <span key={bi} className="bw-md-p">
          {block.split("\n").map((line, li, arr) => (
            <span key={li}>
              {renderInline(line, `${bi}:${li}`)}
              {li < arr.length - 1 && <br />}
            </span>
          ))}
          {bi < blocks.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}
