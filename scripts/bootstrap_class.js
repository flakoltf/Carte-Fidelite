const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, "../certs/credentials.json"), "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });

  const walletobjects = google.walletobjects({ version: "v1", auth });
  
  const issuerId = process.env.GOOGLE_ISSUER_ID || "3388000000023118395";
  const classId = `${issuerId}.ma_classe_fidelite_template`;

  const updatedClass = {
    reviewStatus: "UNDER_REVIEW",
    programLogo: {
      sourceUri: { uri: "https://storage.googleapis.com/wallet-ux-resources/loyalty/logo.png" } 
    }
  };

  try {
    console.log(`Mise à jour de la classe ${classId} vers UNDER_REVIEW...`);
    const res = await walletobjects.loyaltyclass.patch({ 
        resourceId: classId,
        requestBody: updatedClass 
    });
    console.log("Succès ! La classe est maintenant en attente de validation par Google.");
    console.log("Statut actuel :", res.data.reviewStatus);
  } catch (error) {
    console.error("Erreur lors de la mise à jour :", error.response ? error.response.data : error.message);
  }
}

main().catch(console.error);
