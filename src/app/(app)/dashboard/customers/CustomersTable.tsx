"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Calendar, Users, Pencil, Trash2 } from "lucide-react";
import { RedeemCell } from "./RedeemCell";
import { EditCustomerModal, type EditableCustomer } from "./EditCustomerModal";
import { filterCustomers, type CustomerListItem, type StatusFilter } from "@/lib/customers/filter";
import { STAGE_STYLE, LEGEND_ORDER } from "@/lib/segments/stageStyle";
import type { StageKey } from "@/lib/segments/types";

export function CustomersTable({ customers, stampGoal, stageByCustomer }: { customers: CustomerListItem[]; stampGoal: number; stageByCustomer: Record<string, StageKey> }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<EditableCustomer | null>(null);

  const filtered = useMemo(
    () => filterCustomers(customers, query, status, stampGoal),
    [customers, query, status, stampGoal],
  );

  const del = async (c: CustomerListItem) => {
    if (!window.confirm(`Supprimer définitivement ${c.full_name} et toutes ses données ?`)) return;
    const res = await fetch(`/api/customers/${c.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else window.alert("Échec de la suppression.");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight mb-2 text-onyx">Base Clients</h1>
          <p className="text-galet-ink">Gérez vos {customers.length} clients enregistrés.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-galet" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} type="text" placeholder="Rechercher..."
              className="bg-surface border border-line-warm rounded-xl py-2 pl-10 pr-4 text-sm text-onyx focus:border-halo outline-none transition-all w-full md:w-64" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="bg-surface border border-line-warm rounded-xl py-2 px-3 text-sm text-galet-ink">
            <option value="all">Tous</option>
            <option value="full">Carte pleine</option>
            <option value="nocard">Sans carte</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-galet-ink">
        {LEGEND_ORDER.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STAGE_STYLE[k].color }} />
            {STAGE_STYLE[k].label}
          </span>
        ))}
      </div>

      <div className="bg-surface border border-line-warm rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line-warm text-xs font-bold text-galet uppercase tracking-widest bg-[#F7F5EF]">
                <th className="px-8 py-5">Client</th>
                <th className="px-8 py-5">Dernière visite</th>
                <th className="px-8 py-5">Fidélité</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2EEE4]">
              {filtered.length > 0 ? filtered.map((customer) => {
                const card = customer.loyalty_cards?.[0];
                const stage = stageByCustomer[customer.id];
                const dot = stage ? STAGE_STYLE[stage].color : "#98999C";
                return (
                  <tr key={customer.id} className="hover:bg-[#FBFAF6] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: dot }}
                          title={stage ? STAGE_STYLE[stage].label : undefined}>
                          {customer.full_name[0]}
                        </div>
                        <div>
                          <Link
                            href={`/dashboard/customers/${customer.id}`}
                            className="font-bold text-onyx hover:text-halo transition-colors"
                          >
                            {customer.full_name}
                          </Link>
                          <div className="text-xs text-galet">{customer.email || "Email non renseigné"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm text-galet-ink">
                        <Calendar className="w-4 h-4 text-galet" />
                        {card?.last_scan ? new Date(card.last_scan).toLocaleDateString() : "—"}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {card ? (
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 bg-[#ECE7DB] rounded-full overflow-hidden">
                            <div className="h-full bg-halo" style={{ width: `${Math.min(100, (card.stamps_count / stampGoal) * 100)}%` }} />
                          </div>
                          <span className="text-sm text-galet-ink whitespace-nowrap">{card.stamps_count}/{stampGoal}</span>
                        </div>
                      ) : (<span className="text-xs text-galet italic">Pas de carte active</span>)}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2">
                        <RedeemCell cardId={card?.id ?? null} stampsCount={card?.stamps_count ?? null} goal={stampGoal} customerName={customer.full_name} />
                        <button onClick={() => setEditing({ id: customer.id, full_name: customer.full_name, email: customer.email, phone: customer.phone })}
                          title="Modifier" className="p-2 rounded-lg border border-line-warm hover:bg-calcaire">
                          <Pencil className="w-4 h-4 text-galet-ink" />
                        </button>
                        <button onClick={() => del(customer)} title="Supprimer"
                          className="p-2 rounded-lg border border-red-500/30 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-galet">
                      <Users className="w-12 h-12 opacity-30" />
                      <p>Aucun client trouvé.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <EditCustomerModal customer={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
