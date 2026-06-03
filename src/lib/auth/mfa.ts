// Faut-il demander le 2e facteur ? (session mot de passe OK, mais 2FA active non validée)
export function mfaStepUpRequired(
  currentLevel: string | null | undefined,
  nextLevel: string | null | undefined,
): boolean {
  return currentLevel === "aal1" && nextLevel === "aal2";
}

export function isValidTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}
