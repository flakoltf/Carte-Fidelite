import fs from "node:fs";
import path from "node:path";
import { fillPlaceholders } from "@/content/legal/company";

/**
 * Charge un document légal (`src/content/legal/<slug>.md`), remplace les
 * placeholders société, et renvoie le markdown prêt à rendre.
 * Lecture au build (pages statiques) — les fichiers sont présents au build.
 */
export function loadLegalDoc(slug: string): string {
  const file = path.join(process.cwd(), "src", "content", "legal", `${slug}.md`);
  const raw = fs.readFileSync(file, "utf-8");
  return fillPlaceholders(raw);
}
