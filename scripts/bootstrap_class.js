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
  
  const issuerId = process.env.GOOGLE_ISSUER_ID || "BCR2DN5T43NMPIAR";
  const classId = `${issuerId}.ma_classe_fidelite_template`;

  const newClass = {
    id: classId,
    issuerName: "Letaief Solution",
    programName: "Carte de Fidélité VIP",
    programLogo: {
      sourceUri: { uri: "https://upload.wikimedia.org/wikipedia/commons/4/47/React.svg" } // Logo de test
    },
    reviewStatus: "DRAFT"
  };

  try {
    console.log("Tentative de création de la classe...");
    const res = await walletobjects.loyaltyclass.insert({ requestBody: newClass });
    console.log("Classe créée avec succès !", res.data.id);
  } catch (error) {
    if (error.response && error.response.status === 409) {
        console.log("La classe existe déjà. Tout est prêt !");
    } else {
        console.error("Erreur détaillée:", error.response ? error.response.data : error.message);
    }
  }
}

main().catch(console.error);
