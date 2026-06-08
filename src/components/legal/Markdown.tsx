import React from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Renderer Markdown minimal et sans dépendance, suffisant pour les documents
 * légaux HALO : titres (#..####), paragraphes, listes (-/*), tableaux GFM,
 * citations (>), séparateurs (---), **gras**, *italique*, `code`,
 * [liens](url), et le marqueur ⟦à compléter⟧.
 * ────────────────────────────────────────────────────────────────────────── */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let buf = "";
  let n = 0;

  const flush = () => {
    if (buf) {
      nodes.push(buf);
      buf = "";
    }
  };

  const rules: { re: RegExp; render: (m: RegExpMatchArray, key: string) => React.ReactNode }[] = [
    {
      re: /^⟦([^⟧]+)⟧/,
      render: (m, k) => (
        <mark
          key={k}
          className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.85em] font-medium text-amber-800"
          title="Information à compléter dans src/content/legal/company.ts"
        >
          {m[1]}
        </mark>
      ),
    },
    { re: /^\*\*([^*]+)\*\*/, render: (m, k) => <strong key={k} className="font-semibold text-onyx">{renderInline(m[1], k)}</strong> },
    { re: /^`([^`]+)`/, render: (m, k) => <code key={k} className="rounded bg-calcaire px-1.5 py-0.5 font-mono text-[0.85em]">{m[1]}</code> },
    {
      re: /^\[([^\]]+)\]\(([^)]+)\)/,
      render: (m, k) => {
        const external = /^https?:\/\//.test(m[2]);
        return (
          <a
            key={k}
            href={m[2]}
            className="text-halo underline decoration-halo/30 underline-offset-2 transition-colors hover:decoration-halo"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {m[1]}
          </a>
        );
      },
    },
    { re: /^\*([^*]+)\*/, render: (m, k) => <em key={k}>{renderInline(m[1], k)}</em> },
  ];

  while (remaining.length) {
    let matched = false;
    for (const rule of rules) {
      const m = remaining.match(rule.re);
      if (m) {
        flush();
        nodes.push(rule.render(m, `${keyPrefix}-${n++}`));
        remaining = remaining.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      buf += remaining[0];
      remaining = remaining.slice(1);
    }
  }
  flush();
  return nodes;
}

function splitRow(row: string): string[] {
  return row
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  const isSpecial = (l: string) =>
    /^(#{1,4})\s/.test(l) ||
    l.startsWith(">") ||
    l.trim().startsWith("|") ||
    /^\s*[-*]\s+/.test(l) ||
    /^---+\s*$/.test(l) ||
    l.trim() === "";

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      out.push(<hr key={key++} className="my-10 border-line-warm" />);
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const txt = heading[2];
      const cls: Record<number, string> = {
        1: "font-display text-3xl sm:text-4xl font-medium text-onyx mt-2 mb-6 leading-tight",
        2: "font-display text-xl sm:text-2xl font-medium text-onyx mt-10 mb-3",
        3: "font-display text-lg font-medium text-onyx mt-7 mb-2",
        4: "text-base font-semibold text-onyx mt-5 mb-2",
      };
      const inner = renderInline(txt, `h-${key}`);
      out.push(
        level === 1 ? <h1 key={key++} className={cls[1]}>{inner}</h1>
        : level === 2 ? <h2 key={key++} className={cls[2]}>{inner}</h2>
        : level === 3 ? <h3 key={key++} className={cls[3]}>{inner}</h3>
        : <h4 key={key++} className={cls[4]}>{inner}</h4>,
      );
      i++;
      continue;
    }

    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(
        <blockquote key={key++} className="my-5 border-l-2 border-halo/40 bg-calcaire/50 py-3 pl-4 pr-3 text-sm text-galet-ink">
          {renderInline(buf.join(" "), `bq-${key}`)}
        </blockquote>,
      );
      continue;
    }

    if (line.trim().startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i]);
        i++;
      }
      const header = splitRow(rows[0]);
      const body = rows.slice(2).map(splitRow); // rows[1] = séparateur ---|---
      out.push(
        <div key={key++} className="my-6 overflow-x-auto rounded-xl border border-line-warm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-calcaire/60">
                {header.map((c, ci) => (
                  <th key={ci} className="px-4 py-3 text-left font-semibold text-onyx">
                    {renderInline(c, `th-${key}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-t border-line-warm align-top">
                  {row.map((c, ci) => (
                    <td key={ci} className="px-4 py-3 text-galet-ink">
                      {renderInline(c, `td-${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={key++} className="my-4 space-y-2 pl-5">
          {items.map((it, idx) => (
            <li key={idx} className="list-disc text-galet-ink marker:text-halo/60">
              {renderInline(it, `li-${key}-${idx}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Paragraphe : regrouper les lignes consécutives « normales ».
    const para: string[] = [];
    while (i < lines.length && !isSpecial(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(
      <p key={key++} className="my-4 leading-relaxed text-galet-ink">
        {renderInline(para.join(" "), `p-${key}`)}
      </p>,
    );
  }

  return <>{out}</>;
}
