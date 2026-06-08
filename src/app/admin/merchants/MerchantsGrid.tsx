"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { BUSINESS_TYPES } from "@/lib/merchant-config/types";
import EnrollmentQR from "../EnrollmentQR";
import ManageAsButton from "./ManageAsButton";
import ManagementModeToggle from "./ManagementModeToggle";
import {
  filterMerchants,
  paginate,
  MERCHANTS_PAGE_SIZE,
  type MerchantListItem,
  type MerchantFilters,
  type MerchantSort,
  type TriState,
} from "@/lib/admin/merchantsFilter";

const selectCls =
  "bg-surface border border-line-warm rounded-xl px-3 py-2 text-sm text-onyx focus:border-halo outline-none transition-colors";

export default function MerchantsGrid({
  items,
  origin,
}: {
  items: MerchantListItem[];
  origin: string;
}) {
  const [query, setQuery] = useState("");
  const [businessType, setBusinessType] = useState("all");
  const [concierge, setConcierge] = useState<TriState>("all");
  const [hasCard, setHasCard] = useState<TriState>("all");
  const [sort, setSort] = useState<MerchantSort>("recent");
  const [page, setPage] = useState(1);

  const filters: MerchantFilters = { businessType, concierge, hasCard };

  const filtered = useMemo(
    () => filterMerchants(items, query, filters, sort),
    [items, query, businessType, concierge, hasCard, sort],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / MERCHANTS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = paginate(filtered, safePage, MERCHANTS_PAGE_SIZE);

  // Revenir page 1 quand un critère change.
  const onCriteriaChange = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  // Aucun marchand du tout (≠ aucun résultat de filtre).
  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-galet border-2 border-dashed border-line-warm rounded-3xl">
        Aucun marchand. Créez-en un avec « Nouveau marchand ».
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barre de recherche + filtres + tri */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-galet absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => onCriteriaChange(setQuery)(e.target.value)}
            placeholder="Rechercher un marchand (nom, email)…"
            className="w-full bg-surface border border-line-warm rounded-xl pl-9 pr-3 py-2 text-sm text-onyx focus:border-halo outline-none transition-colors placeholder:text-galet"
          />
        </div>

        <select
          value={businessType}
          onChange={(e) => onCriteriaChange(setBusinessType)(e.target.value)}
          className={selectCls}
          aria-label="Type de commerce"
        >
          <option value="all">Tous les types</option>
          {BUSINESS_TYPES.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select
          value={concierge}
          onChange={(e) => onCriteriaChange(setConcierge)(e.target.value as TriState)}
          className={selectCls}
          aria-label="Mode concierge"
        >
          <option value="all">Concierge : tous</option>
          <option value="yes">Géré par nous</option>
          <option value="no">Géré par lui</option>
        </select>

        <select
          value={hasCard}
          onChange={(e) => onCriteriaChange(setHasCard)(e.target.value as TriState)}
          className={selectCls}
          aria-label="Carte configurée"
        >
          <option value="all">Carte : toutes</option>
          <option value="yes">Carte configurée</option>
          <option value="no">Sans carte</option>
        </select>

        <select
          value={sort}
          onChange={(e) => onCriteriaChange(setSort)(e.target.value as MerchantSort)}
          className={selectCls}
          aria-label="Tri"
        >
          <option value="recent">Plus récents</option>
          <option value="name">Nom (A→Z)</option>
        </select>
      </div>

      <p className="text-xs text-galet-ink">
        {filtered.length} marchand{filtered.length > 1 ? "s" : ""}
        {filtered.length !== items.length ? ` sur ${items.length}` : ""}
      </p>

      {/* Aucun résultat pour le filtre courant */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-galet border-2 border-dashed border-line-warm rounded-3xl">
          Aucun marchand ne correspond à ces critères.
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {pageItems.map((m) => (
              <div key={m.id} className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
                      style={{ backgroundColor: m.primary_color || "#0D6B5E" }}
                    >
                      {(m.shop_name || "?")[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-onyx">{m.shop_name}</div>
                      <div className="text-xs text-galet-ink">{m.email || "—"}</div>
                    </div>
                  </div>
                  <Link
                    href={`/admin/merchants/${m.id}`}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-surface border border-line-warm hover:bg-calcaire text-galet-ink transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Éditer
                  </Link>
                </div>

                {!m.has_card && (
                  <span className="inline-block mb-4 text-[11px] font-semibold rounded-full px-2.5 py-1 bg-amber-500/10 text-amber-700 border border-amber-500/30">
                    Carte à configurer
                  </span>
                )}

                <div className="flex gap-6 text-sm mb-6">
                  <div>
                    <span className="text-2xl font-bold text-onyx">{m.customer_count}</span>
                    <span className="text-galet-ink ml-1.5">clients</span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-onyx">{m.scan_count}</span>
                    <span className="text-galet-ink ml-1.5">scans</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <ManagementModeToggle merchantId={m.id} initial={m.managed_by_concierge} />
                  <ManageAsButton merchantId={m.id} />
                </div>

                <div className="border-t border-line-warm pt-6">
                  <EnrollmentQR
                    url={`${origin}/enroll/${m.enrollment_token}`}
                    fileName={`qr-${m.shop_name?.toLowerCase().replace(/\s+/g, "-") || "marchand"}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="flex items-center gap-1 text-sm px-3 py-2 rounded-xl border border-line-warm text-galet-ink hover:bg-calcaire disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Précédent
              </button>
              <span className="text-sm text-galet-ink">Page {safePage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="flex items-center gap-1 text-sm px-3 py-2 rounded-xl border border-line-warm text-galet-ink hover:bg-calcaire disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Suivant <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
