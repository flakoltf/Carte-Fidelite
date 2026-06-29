"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useFocusTrap } from "../_components/useFocusTrap";

export type EditableCustomer = { id: string; full_name: string; email: string | null; phone: string | null };

export function EditCustomerModal({ customer, onClose }: { customer: EditableCustomer; onClose: () => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(customer.full_name);
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const titleId = useId();
  const nameId = useId();
  const emailId = useId();
  const phoneId = useId();

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Échec");
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full bg-surface border border-line-warm rounded-xl px-4 py-3 text-sm text-onyx placeholder:text-galet-ink focus:border-halo outline-none focus-visible:ring-2 focus-visible:ring-halo focus-visible:ring-offset-1 transition-all";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-surface border border-line-warm rounded-3xl shadow-xl p-6 w-full max-w-md space-y-4 focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="font-display text-lg font-bold text-onyx">Modifier le client</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-galet-ink hover:text-onyx"><X className="w-5 h-5" aria-hidden /></button>
        </div>
        <div className="space-y-1">
          <label htmlFor={nameId} className="text-sm text-galet-ink">Nom</label>
          <input id={nameId} data-autofocus value={fullName} onChange={(e) => setFullName(e.target.value)} className={input} />
        </div>
        <div className="space-y-1">
          <label htmlFor={emailId} className="text-sm text-galet-ink">Email</label>
          <input id={emailId} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </div>
        <div className="space-y-1">
          <label htmlFor={phoneId} className="text-sm text-galet-ink">Téléphone</label>
          <input id={phoneId} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optionnel" className={input} />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-surface border border-line-warm hover:bg-calcaire text-galet-ink text-sm transition-colors">Annuler</button>
          <button onClick={save} disabled={busy}
            className="px-5 py-2 rounded-xl bg-halo text-white font-bold text-sm hover:bg-halo-600 disabled:opacity-50 transition-colors">
            {busy ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
