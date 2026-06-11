"use client";

// Affichette QR « prête à imprimer » (PDF A6) — générée côté client, aucune
// donnée envoyée au serveur. @react-pdf/renderer est importé dynamiquement
// pour ne rien peser tant que le marchand ne clique pas.

import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QRCode from "react-qr-code";
import { FileDown, Loader2 } from "lucide-react";

// SVG du QR → PNG data-URL (le moteur PDF n'embarque pas de rendu SVG natif).
async function qrPngDataUrl(url: string, size = 640): Promise<string> {
  const svgMarkup = renderToStaticMarkup(<QRCode value={url} size={size} />);
  const svg64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgMarkup)));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas indisponible"));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("rendu QR impossible"));
    img.src = svg64;
  });
}

export default function QrPosterButton({
  url,
  shopName,
  fileName = "affichette-halo",
  className = "",
}: {
  url: string;
  shopName: string;
  fileName?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      const [{ pdf, Document, Page, Text, View, Image: PdfImage, StyleSheet }, qrPng] = await Promise.all([
        import("@react-pdf/renderer"),
        qrPngDataUrl(url),
      ]);

      const styles = StyleSheet.create({
        page: {
          backgroundColor: "#FFFFFF",
          paddingVertical: 26,
          paddingHorizontal: 22,
          alignItems: "center",
          fontFamily: "Helvetica",
        },
        shop: { fontSize: 17, fontFamily: "Helvetica-Bold", color: "#0E0F11", textAlign: "center" },
        tagline: { marginTop: 6, fontSize: 10.5, color: "#3E4044", textAlign: "center", lineHeight: 1.4 },
        qrWrap: {
          marginTop: 16,
          padding: 10,
          borderWidth: 1.2,
          borderColor: "#0D6B5E",
          borderRadius: 10,
        },
        qr: { width: 168, height: 168 },
        wallets: { marginTop: 12, fontSize: 9.5, color: "#0D6B5E", textAlign: "center", fontFamily: "Helvetica-Bold" },
        steps: { marginTop: 10, fontSize: 9, color: "#6E7073", textAlign: "center", lineHeight: 1.5 },
        footer: {
          position: "absolute",
          bottom: 16,
          left: 0,
          right: 0,
          fontSize: 8,
          color: "#9B9DA0",
          textAlign: "center",
        },
      });

      const doc = (
        <Document title={`Affichette fidélité — ${shopName}`}>
          {/* A6 : se pose en caisse, à hauteur des yeux. */}
          <Page size="A6" style={styles.page}>
            <Text style={styles.shop}>{shopName}</Text>
            <Text style={styles.tagline}>Notre carte de fidélité, directement dans votre téléphone.</Text>
            <View style={styles.qrWrap}>
              <PdfImage src={qrPng} style={styles.qr} />
            </View>
            <Text style={styles.wallets}>Apple Wallet · Google Wallet — sans application</Text>
            <Text style={styles.steps}>1. Scannez le QR avec votre appareil photo{"\n"}2. Ajoutez la carte à votre téléphone{"\n"}3. Cumulez à chaque passage</Text>
            <Text style={styles.footer}>Programme de fidélité propulsé par HALO — halocard.ch</Text>
          </Page>
        </Document>
      );

      const blob = await pdf(doc).toBlob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      // Signal pour la checklist de démarrage (« Imprimez votre affichette »).
      try {
        window.localStorage.setItem("halo_poster_done", "1");
      } catch {
        /* stockage local indisponible : la checklist se validera via les données */
      }
    } catch {
      setError("Génération du PDF impossible. Réessayez, ou téléchargez le QR en PNG.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className={
          className ||
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-onyx px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-onyx-soft active:scale-95 disabled:opacity-50"
        }
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileDown className="h-4 w-4" aria-hidden />}
        Affichette à imprimer (PDF)
      </button>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
