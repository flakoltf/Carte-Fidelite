import path from "node:path";

// Chemin du storageState (cookies sb-* de session marchande), partagé par la
// config Playwright et le projet setup. Fichier neutre (aucun appel test()/setup())
// pour pouvoir être importé depuis playwright.config.ts sans erreur de chargement.
export const STORAGE_STATE = path.join(__dirname, ".auth", "merchant.json");
