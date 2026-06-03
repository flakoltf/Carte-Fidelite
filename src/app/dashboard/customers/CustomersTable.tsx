"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Mail, Smartphone, Calendar, Users, Pencil, Trash2 } from "lucide-react";
import { RedeemCell } from "./RedeemCell";
import { EditCustomerModal, type EditableCustomer } from "./EditCustomerModal";
import { filterCustomers, type CustomerListItem, type StatusFilter } from "@/lib/customers/filter";

export function CustomersTable({ customers, stampGoal }: { customers: CustomerListItem[]; stampGoal: number }) {
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
          <h1 className="text-3xl font-bold tracking-tight mb-2">Base Clients</h1>
          <p className="text-zinc-500">Gérez vos {customers.length} clients enregistrés.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} type="text" placeholder="Rechercher..."
              className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:border-emerald-500/50 outline-none transition-all w-full md:w-64" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-zinc-300">
            <option value="all">Tous</option>
            <option value="full">Carte pleine</option>
            <option value="nocard">Sans carte</option>
          </select>
        </div>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-[32px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-widest bg-zinc-950/20">
                <th className="px-8 py-5">Client</th>
                <th className="px-8 py-5">Fidélité</th>
                <th className="px-8 py-5">Contact</th>
                <th className="px-8 py-5">Dernière Visite</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.length > 0 ? filtered.map((customer) => {
                const card = customer.loyalty_cards?.[0];
                return (
                  <tr key={customer.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                          {customer.full_name[0]}
                        </div>
                        <div>
                          <div className="font-bold">{customer.full_name}</div>
                          <div className="text-xs text-zinc-500">ID: {customer.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {card ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="text-sm font-bold text-emerald-400">{card.stamps_count} / {stampGoal} pts</div>
                          <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (card.stamps_count / stampGoal) * 100)}%` }} />
                          </div>
                        </div>
                      ) : (<span className="text-xs text-zinc-600 italic">Pas de carte active</span>)}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs text-zinc-400"><Mail className="w-3 h-3" />{customer.email || "Non renseigné"}</div>
                        <div className="flex items-center gap-2 text-xs text-zinc-400"><Smartphone className="w-3 h-3" />{customer.phone || "Non renseigné"}</div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm text-zinc-500 underline decoration-zinc-800 underline-offset-4">
                        <Calendar className="w-4 h-4" />
                        {card?.last_scan ? new Date(card.last_scan).toLocaleDateString() : "—"}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2">
                        <RedeemCell cardId={card?.id ?? null} stampsCount={card?.stamps_count ?? null} goal={stampGoal} customerName={customer.full_name} />
                        <button onClick={() => setEditing({ id: customer.id, full_name: customer.full_name, email: customer.email, phone: customer.phone })}
                          title="Modifier" className="p-2 rounded-lg border border-zinc-700 hover:bg-zinc-800">
                          <Pencil className="w-4 h-4 text-zinc-400" />
                        </button>
                        <button onClick={() => del(customer)} title="Supprimer"
                          className="p-2 rounded-lg border border-red-500/30 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-zinc-600">
                      <Users className="w-12 h-12 opacity-20" />
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
