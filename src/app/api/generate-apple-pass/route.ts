// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { PKPass } from "passkit-generator";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { customerName, currentStamps } = await req.json();

    if (!customerName || currentStamps === undefined) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    // 1. Initialisation des Certificats Apple
    const wwdrPath = process.env.WWDR_PEM_PATH || "certs/wwdr.pem";
    const signerCertPath = process.env.SIGNER_CERT_PATH || "certs/signerCert.pem";
    const signerKeyPath = process.env.SIGNER_KEY_PATH || "certs/signerKey.pem";
    const signerKeyPassphrase = process.env.SIGNER_KEY_PASSPHRASE || "";

    // On vérifie si les certificats existent, sinon ça plantera logiquement
    let wwdr, signerCert, signerKey;
    try {
        [wwdr, signerCert, signerKey] = await Promise.all([
        fs.readFile(path.join(process.cwd(), wwdrPath)),
        fs.readFile(path.join(process.cwd(), signerCertPath)),
        fs.readFile(path.join(process.cwd(), signerKeyPath))
        ]);
    } catch (e) {
        throw new Error("Certificats Apple manquants dans le dossier /certs. Il faut ajouter wwdr.pem, signerCert.pem et signerKey.pem.");
    }

    // 2. Création et configuration du Pass
    const pass = new PKPass({
      "passTypeIdentifier": process.env.APPLE_PASS_TYPE_ID || "pass.com.tamarque.fidelite",
      "teamIdentifier": process.env.APPLE_TEAM_ID || "ABCDE12345",
      "organizationName": "Ma Super Marque",
      "logoText": "Fidélité",
      "description": "Carte de fidélité numérique",
      "backgroundColor": "rgb(23, 23, 23)", 
      "foregroundColor": "rgb(255, 255, 255)", 
      "labelColor": "rgb(156, 163, 175)", 
    }, {
      wwdr,
      signerCert,
      signerKey,
      signerKeyPassphrase,
    });

    // 3. Paramétrage du modèle "storeCard"
    pass.type = "storeCard";

    pass.primaryFields.push({
      key: "stamps",
      label: "TAMPONS",
      value: `${currentStamps} / 10`,
      textAlignment: "PKTextAlignmentRight"
    });

    pass.secondaryFields.push({
      key: "customerName",
      label: "CLIENT",
      value: customerName
    });

    pass.setBarcodes({
      message: `CUST-${customerName}-${Date.now()}`,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText: "Scannez pour valider vos tampons"
    });

    // 4. Chargement des images Apple Wallet
    const assetsPath = path.join(process.cwd(), "public", "pass-assets");
    
    try {
        pass.addBuffer("icon.png", await fs.readFile(path.join(assetsPath, "icon.png")));
        pass.addBuffer("icon@2x.png", await fs.readFile(path.join(assetsPath, "icon@2x.png")));
        pass.addBuffer("logo.png", await fs.readFile(path.join(assetsPath, "logo.png")));
        pass.addBuffer("strip.png", await fs.readFile(path.join(assetsPath, "strip.png"))); 
    } catch (e) {
        console.warn("Certaines images (icon.png, logo.png, strip.png) n'ont pas été trouvées dans public/pass-assets. Le pass pourrait ne pas s'afficher correctement.");
    }
    
    // 5. Compilation finale du pass
    const passBuffer = pass.getAsBuffer();

    // 6. Retourner le fichier
    return new NextResponse(passBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="carte-fidelite.pkpass"`,
      },
    });

  } catch (error: any) {
    console.error("Erreur de génération du Apple Pass:", error);
    return NextResponse.json({ error: error.message || "Erreur lors de la génération de la carte Apple" }, { status: 500 });
  }
}
