import { NextResponse } from "next/server";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import fs from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  try {
    const { customerName, currentStamps } = await req.json();

    if (!customerName || currentStamps === undefined) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    // 1. Charger les credentials Google depuis le fichier JSON qu'on vient de lier
    const credentialsPath = path.join(process.cwd(), "certs", "credentials.json");
    const credentialsRaw = await fs.readFile(credentialsPath, "utf-8");
    const credentials = JSON.parse(credentialsRaw);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });

    // Optionnel : s'assurer que c'est bien authentifié 
    // const client = await auth.getClient();
    
    // 2. Définir les IDs (L'ISSUER_ID doit venir des variables d'environnement)
    // Va sur la Google Pay & Wallet Console pour obtenir ton Issuer ID !
    const issuerId = process.env.GOOGLE_ISSUER_ID || "REMPLACE_PAR_TON_ISSUER_ID"; 
    
    // Cette classe doit d'abord être créée manuellement dans la console Google ou via l'API.
    // Par exemple: 3388000000000000001.ma_classe_deesse
    const classId = `${issuerId}.ma_classe_fidelite_template`; 
    
    // L'identifiant unique de la carte pour CE client
    const objectId = `${issuerId}.client_${Date.now()}`; 

    // 3. Définition de l'objet de fidélité pour le client
    const loyaltyObject = {
      id: objectId,
      classId: classId,
      state: "ACTIVE",
      accountId: `CUST-${Date.now()}`,
      accountName: customerName,
      loyaltyPoints: {
        balance: { int: currentStamps },
        label: "Tampons"
      },
      barcode: {
        type: "QR_CODE",
        value: `CUST-${customerName}-${Date.now()}`
      }
    };

    // 4. Création des revendications (claims) et signature du JWT
    const claims = {
      iss: credentials.client_email,
      aud: "google",
      // Remplace par la véritable URL de ton frontend pour la sécurité en production
      origins: ["http://localhost:3000", "https://ton-saas.com"], 
      typ: "savetowallet",
      payload: {
        loyaltyObjects: [loyaltyObject]
      }
    };

    const token = jwt.sign(claims, credentials.private_key, { algorithm: "RS256" });

    // 5. Générer l'URL Save to Google Pay
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

    return NextResponse.json({ saveUrl, success: true });

  } catch (error: any) {
    console.error("Erreur Google Wallet:", error);
    return NextResponse.json({ error: error.message || "Erreur de génération du lien Google Wallet" }, { status: 500 });
  }
}
