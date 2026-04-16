const qr = require("qrcode-terminal");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, "../certs/credentials.json"), "utf-8"));
  
  const issuerId = process.env.GOOGLE_ISSUER_ID;
  const classId = `${issuerId}.ma_classe_fidelite_template`; 
  const objectId = `${issuerId}.client_XIAOMI_TEST_${Date.now()}`; 

  const loyaltyObject = {
    id: objectId,
    classId: classId,
    state: "ACTIVE",
    accountId: `CUST-TEST`,
    accountName: "Moi-Même (Test Xiaomi)",
    loyaltyPoints: {
      balance: { int: 8 },
      label: "Tampons"
    },
    barcode: {
      type: "QR_CODE",
      value: `CUST-TEST-${Date.now()}`
    }
  };

  const claims = {
    iss: credentials.client_email,
    aud: "google",
    origins: ["http://localhost:3000"], 
    typ: "savetowallet",
    payload: {
      loyaltyObjects: [loyaltyObject]
    }
  };

  const token = jwt.sign(claims, credentials.private_key, { algorithm: "RS256" });
  const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

  console.log("\n==============================================");
  console.log("LIEN GOOGLE WALLET :", saveUrl);
  console.log("==============================================\n");
  console.log("Scannez ce QR Code avec l'appareil photo de votre Xiaomi :");
  
  qr.generate(saveUrl, { small: true });
}

main().catch(console.error);
