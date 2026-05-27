// Vérifie (lecture seule) l'accès à l'API Google Wallet et l'existence de la classe de fidélité.
import dotenv from "dotenv";
import fs from "node:fs";
import { google } from "googleapis";

dotenv.config({ path: ".env.local" });

const creds = JSON.parse(fs.readFileSync("certs/credentials.json", "utf-8"));
const issuerId = process.env.GOOGLE_ISSUER_ID;
const classId = `${issuerId}.ma_classe_fidelite_template`;

const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
});
const wallet = google.walletobjects({ version: "v1", auth: await auth.getClient() });

console.log("Issuer ID :", issuerId);
console.log("Classe    :", classId);
console.log("Service   :", creds.client_email);
console.log("");

try {
  const r = await wallet.loyaltyclass.get({ resourceId: classId });
  console.log("=> CLASSE EXISTE DÉJÀ.");
  console.log("   programName  :", r.data.programName);
  console.log("   issuerName   :", r.data.issuerName);
  console.log("   reviewStatus :", r.data.reviewStatus);
} catch (e) {
  const status = e.code || e.response?.status;
  if (status === 404) {
    console.log("=> CLASSE ABSENTE (404) — il faudra la créer.");
  } else {
    console.log("=> ERREUR API :", status);
    console.log("   détail :", JSON.stringify(e.errors || e.response?.data || e.message));
  }
}