"use client";
import { useState } from "react";
import { STAGE_FAMILIES, STAGE_LABELS, FLAG_LABELS, type StageKey } from "@/lib/segments/types";
import type { SegmentSummary } from "@/lib/segments/summary";
import type { Member } from "@/lib/segments/fetch";
import { STAGE_STYLE } from "@/lib/segments/stageStyle";

export function SegmentsView({ summary }: { summary: SegmentSummary }) {
  const [active, setActive] = useState<StageKey | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const open = async (stage: StageKey) => {
    setActive(stage);
    setLoading(true);
    setMembers([]);
    try {
      const res = await fetch(`/api/segments/${stage}`);
      const json = await res.json();
      setMembers(json.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {STAGE_FAMILIES.map((family) => (
        <div key={family.title}>
          <h2 className="text-sm font-bold text-galet-ink uppercase tracking-widest mb-4">{family.title}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {family.stages.map((stage) => {
              const s = summary.stages[stage];
              return (
                <button
                  key={stage}
                  onClick={() => open(stage)}
                  className={`text-left bg-surface shadow-sm border rounded-3xl p-6 transition-all hover:border-halo/50 ${
                    active === stage ? "border-halo" : "border-line-warm"
                  }`}
                >
                  <span className="inline-block w-2.5 h-2.5 rounded-full mb-2" style={{ backgroundColor: STAGE_STYLE[stage].color }} />
                  <div className="text-sm font-bold text-onyx">{STAGE_LABELS[stage]}</div>
                  <div className="text-3xl font-bold mt-2 text-onyx">{s.count}</div>
                  <div className="text-xs text-halo mt-1">{s.pct} % de la base</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <h2 className="text-sm font-bold text-galet-ink uppercase tracking-widest mb-4">Étiquettes</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="bg-surface border border-line-warm rounded-2xl px-4 py-2">
            {FLAG_LABELS.recompense_prete} : <strong>{summary.flags.recompense_prete}</strong>
          </span>
          <span className="bg-surface border border-line-warm rounded-2xl px-4 py-2">
            {FLAG_LABELS.joignable_push} : <strong>{summary.flags.joignable_push}</strong>
          </span>
        </div>
      </div>

      {active && (
        <div className="bg-surface border border-line-warm shadow-sm rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">{STAGE_LABELS[active]} — {members.length} client(s)</h3>
            <a
              href={`/api/segments/export/csv?segment=${active}`}
              className="bg-halo text-white rounded-xl px-4 py-2 text-sm font-bold"
            >
              Exporter CSV
            </a>
          </div>
          {loading ? (
            <div className="h-24 animate-pulse bg-[#ECE7DB] rounded-xl" />
          ) : members.length === 0 ? (
            <p className="text-sm text-galet-ink">Aucun client dans ce groupe.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-galet-ink border-b border-line-warm">
                  <th className="py-3">Client</th>
                  <th className="py-3">Dernière visite</th>
                  <th className="py-3">Visites</th>
                  <th className="py-3">Tampons</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.customerId} className="border-b border-[#F2EEE4]">
                    <td className="py-3">{m.name}</td>
                    <td className="py-3 text-galet-ink">{m.lastScan ? new Date(m.lastScan).toLocaleDateString() : "—"}</td>
                    <td className="py-3">{m.visits}</td>
                    <td className="py-3">{m.stamps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
