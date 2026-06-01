"use client";
import { useState } from "react";
import { STAGE_FAMILIES, STAGE_LABELS, FLAG_LABELS, type StageKey } from "@/lib/segments/types";
import type { SegmentSummary } from "@/lib/segments/summary";
import type { Member } from "@/lib/segments/fetch";

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
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">{family.title}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {family.stages.map((stage) => {
              const s = summary.stages[stage];
              return (
                <button
                  key={stage}
                  onClick={() => open(stage)}
                  className={`text-left bg-zinc-900/40 border rounded-3xl p-6 transition-all hover:border-emerald-500/50 ${
                    active === stage ? "border-emerald-500/70" : "border-zinc-800"
                  }`}
                >
                  <div className="text-sm font-bold text-zinc-300">{STAGE_LABELS[stage]}</div>
                  <div className="text-3xl font-bold mt-2">{s.count}</div>
                  <div className="text-xs text-emerald-400 mt-1">{s.pct} % de la base</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Étiquettes</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="bg-zinc-900/40 border border-zinc-800 rounded-2xl px-4 py-2">
            {FLAG_LABELS.recompense_prete} : <strong>{summary.flags.recompense_prete}</strong>
          </span>
          <span className="bg-zinc-900/40 border border-zinc-800 rounded-2xl px-4 py-2">
            {FLAG_LABELS.joignable_push} : <strong>{summary.flags.joignable_push}</strong>
          </span>
        </div>
      </div>

      {active && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">{STAGE_LABELS[active]} — {members.length} client(s)</h3>
            <a
              href={`/api/segments/export/csv?segment=${active}`}
              className="bg-emerald-500 text-black rounded-xl px-4 py-2 text-sm font-bold"
            >
              Exporter CSV
            </a>
          </div>
          {loading ? (
            <div className="h-24 animate-pulse bg-zinc-800/40 rounded-xl" />
          ) : members.length === 0 ? (
            <p className="text-sm text-zinc-600">Aucun client dans ce groupe.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
                  <th className="py-3">Client</th>
                  <th className="py-3">Dernière visite</th>
                  <th className="py-3">Visites</th>
                  <th className="py-3">Tampons</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.customerId} className="border-b border-zinc-900">
                    <td className="py-3">{m.name}</td>
                    <td className="py-3 text-zinc-400">{m.lastScan ? new Date(m.lastScan).toLocaleDateString() : "—"}</td>
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
