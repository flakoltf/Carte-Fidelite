// Contrat historique {errors, warnings} du studio — délègue désormais au moteur
// riche `validateTemplate` (Issue[] avec sévérités). errors = sévérité 'error'
// (bloquent la publication), warnings = sévérité 'warning'. Les 'info' ne
// figurent pas dans ce contrat plat (affichées par le panneau de validation).

import type { CardDesign } from "./types";
import type { ValidationResult } from "./validation";
import { validateTemplate } from "./validateTemplate";

export { STAMP_GOAL_MIN, STAMP_GOAL_MAX, PROGRAM_NAME_SOFT_MAX } from "./validateTemplate";

export function validateStudioDesign(design: CardDesign): ValidationResult {
  const issues = validateTemplate(design);
  return {
    errors: issues.filter((i) => i.severity === "error").map((i) => i.message),
    warnings: issues.filter((i) => i.severity === "warning").map((i) => i.message),
  };
}
