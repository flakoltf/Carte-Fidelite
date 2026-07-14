// Diff pur entre deux designs de carte (brouillon vs publié, ou entre deux
// versions de l'historique). Testable sans DOM ni réseau. Sert au « diff visuel »
// du studio et à tout affichage d'historique.

import type { CardDesign, CardField } from "./types";

export interface DesignChange {
  /** Chemin technique (ex. "colors.background", "field:<id>"). */
  path: string;
  /** Libellé lisible en FR. */
  label: string;
  before?: string;
  after?: string;
  kind: "modified" | "added" | "removed";
}

function scalar(prev: string | undefined, next: string | undefined, path: string, label: string, out: DesignChange[]) {
  const a = prev ?? "";
  const b = next ?? "";
  if (a !== b) out.push({ path, label, before: a || "—", after: b || "—", kind: "modified" });
}

function fieldSummary(f: CardField): string {
  return `${f.label || "(sans libellé)"} = ${f.value || "—"} [${f.zone}]`;
}

export function diffDesign(prev: CardDesign, next: CardDesign): DesignChange[] {
  const out: DesignChange[] = [];

  scalar(prev.programName, next.programName, "programName", "Nom du programme", out);
  scalar(prev.colors.background, next.colors.background, "colors.background", "Couleur de fond", out);
  scalar(prev.colors.foreground, next.colors.foreground, "colors.foreground", "Couleur du texte", out);
  scalar(prev.colors.label, next.colors.label, "colors.label", "Couleur des libellés", out);
  scalar(prev.cardType ?? "stamps", next.cardType ?? "stamps", "cardType", "Type de carte", out);
  scalar(prev.barcode?.type, next.barcode?.type, "barcode.type", "Type de code-barres", out);
  scalar(
    prev.stamps?.goal != null ? String(prev.stamps.goal) : undefined,
    next.stamps?.goal != null ? String(next.stamps.goal) : undefined,
    "stamps.goal",
    "Objectif de tampons",
    out,
  );

  // Champs — appariés par id.
  const prevById = new Map(prev.fields.map((f) => [f.id, f]));
  const nextById = new Map(next.fields.map((f) => [f.id, f]));
  for (const f of next.fields) {
    const before = prevById.get(f.id);
    if (!before) {
      out.push({ path: `field:${f.id}`, label: "Champ ajouté", after: fieldSummary(f), kind: "added" });
    } else if (before.label !== f.label || before.value !== f.value || before.zone !== f.zone) {
      out.push({ path: `field:${f.id}`, label: "Champ modifié", before: fieldSummary(before), after: fieldSummary(f), kind: "modified" });
    }
  }
  for (const f of prev.fields) {
    if (!nextById.has(f.id)) {
      out.push({ path: `field:${f.id}`, label: "Champ supprimé", before: fieldSummary(f), kind: "removed" });
    }
  }

  return out;
}
