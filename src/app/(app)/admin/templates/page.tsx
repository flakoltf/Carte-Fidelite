import Link from "next/link";
import { Palette, ExternalLink, Sparkles } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { PageHeader, Section, EmptyState, Pill, formatDateCH } from "../components/ui";

export const dynamic = "force-dynamic";

// Templates & contenu : vue de gestion des designs de cartes du parc et des
// réglages par défaut. Cette page RÉFÉRENCE le studio de design (territoire de
// l'agent marchand) sans le modifier — chaque ligne pointe vers le studio.
export default async function AdminTemplates() {
  const supabase = await createClient();

  const [{ data: designs }, { data: merchants }] = await Promise.all([
    supabase
      .from("card_designs")
      .select("merchant_id, background_color, foreground_color, program_name, google_class_id, google_class_synced_at, updated_at"),
    supabase.from("merchants").select("id, shop_name, business_type, role").eq("role", "merchant"),
  ]);

  const designByMerchant = new Map((designs ?? []).map((d) => [d.merchant_id as string, d]));
  const rows = (merchants ?? [])
    .map((m) => ({
      id: m.id as string,
      shopName: (m.shop_name as string) ?? "—",
      businessType: (m.business_type as string) ?? "autre",
      design: designByMerchant.get(m.id as string) ?? null,
    }))
    .sort((a, b) => a.shopName.localeCompare(b.shopName, "fr"));

  const withDesign = rows.filter((r) => r.design);
  const byType = new Map<string, number>();
  for (const r of rows) byType.set(r.businessType, (byType.get(r.businessType) ?? 0) + 1);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Templates & contenu"
        subtitle="Les designs de cartes du parc, secteur par secteur. L'édition se fait dans le studio de design, ouvert depuis chaque ligne."
      />

      {/* ── Réglages par défaut ──────────────────────────────────────── */}
      <Section
        title="Réglages par défaut (nouveau marchand)"
        description="Valeurs appliquées tant que la carte n'a pas été personnalisée dans le studio — définies en base (card_designs) et en code."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DefaultItem label="Couleur de fond" value="#0D6B5E (vert HALO)" swatch="#0D6B5E" />
          <DefaultItem label="Couleur du texte" value="#FFFFFF" swatch="#FFFFFF" />
          <DefaultItem label="Nom du programme" value="« Carte de fidélité »" />
          <DefaultItem label="Code-barres" value="QR — jeton de carte" />
        </div>
      </Section>

      {/* ── Parc par secteur ─────────────────────────────────────────── */}
      <Section title="Répartition par secteur" description="Base de la future bibliothèque de templates sectoriels.">
        <div className="flex flex-wrap gap-3">
          {[...byType.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <span key={type} className="rounded-2xl border border-line-warm bg-calcaire px-4 py-2 text-sm text-onyx">
                <span className="font-bold">{count}</span> · {type}
              </span>
            ))}
          {byType.size === 0 && <p className="text-sm text-galet-ink">Aucun marchand pour l&apos;instant.</p>}
        </div>
      </Section>

      {/* ── Designs du parc ──────────────────────────────────────────── */}
      <Section
        title={
          <span className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-halo" aria-hidden /> Designs de cartes ({withDesign.length} / {rows.length} personnalisés)
          </span>
        }
        description="Chaque ligne ouvre le studio de design du marchand (référence — l'édition vit là-bas)."
      >
        {rows.length === 0 ? (
          <EmptyState title="Aucun marchand." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line-warm">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line-warm bg-calcaire text-left text-xs uppercase tracking-wide text-galet-ink">
                  <th className="px-4 py-3">Marchand</th>
                  <th className="px-4 py-3">Secteur</th>
                  <th className="px-4 py-3">Design</th>
                  <th className="px-4 py-3">Classe Google</th>
                  <th className="px-4 py-3">Modifié</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line-warm last:border-0 hover:bg-calcaire/60">
                    <td className="px-4 py-2.5 font-semibold text-onyx">{r.shopName}</td>
                    <td className="px-4 py-2.5 text-galet-ink">{r.businessType}</td>
                    <td className="px-4 py-2.5">
                      {r.design ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-4 w-4 rounded-full border border-line-warm"
                            style={{ backgroundColor: (r.design.background_color as string) ?? "#0D6B5E" }}
                            aria-hidden
                          />
                          <span className="text-onyx">{(r.design.program_name as string) ?? "—"}</span>
                        </span>
                      ) : (
                        <Pill tone="neutre">défaut</Pill>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.design?.google_class_id ? (
                        <Pill tone="vert">synchronisée</Pill>
                      ) : (
                        <Pill tone="neutre">—</Pill>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-galet-ink">
                      {r.design ? formatDateCH(r.design.updated_at as string) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/admin/merchants/${r.id}/card`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-halo hover:underline"
                      >
                        Ouvrir le studio <ExternalLink className="h-3 w-3" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Templates sectoriels : pas encore ────────────────────────── */}
      <Section
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-600" aria-hidden /> Templates sectoriels — à instrumenter
          </span>
        }
      >
        <p className="text-sm leading-relaxed text-galet-ink">
          Il n&apos;existe pas encore de bibliothèque de templates par secteur (café, salon, institut…) :
          chaque design part du défaut. Proposition : une table <code className="rounded bg-calcaire px-1">card_design_templates</code>{" "}
          (secteur, couleurs, champs, nom de programme) + un bouton « partir d&apos;un template » dans le
          studio — à construire avec l&apos;agent marchand, noté comme dépendance dans AGENT-B-MANIFESTE.md.
        </p>
      </Section>
    </div>
  );
}

function DefaultItem({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="rounded-2xl border border-line-warm bg-calcaire p-4">
      <div className="flex items-center gap-2">
        {swatch && <span className="h-4 w-4 rounded-full border border-line-warm" style={{ backgroundColor: swatch }} aria-hidden />}
        <span className="text-sm font-bold text-onyx">{label}</span>
      </div>
      <p className="mt-1 text-xs text-galet-ink">{value}</p>
    </div>
  );
}
