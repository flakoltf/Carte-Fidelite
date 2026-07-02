"use client";

import QRCode from "react-qr-code";

// « Essayez sur votre téléphone » — l'argument n°1 du produit (scanner → carte
// dans le téléphone, sans appli) doit être vivable depuis le site : ce QR mène
// à l'enrôlement réel de la boutique de démonstration.
export default function TryItQR() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-2xl border border-line-warm bg-white p-3">
        <QRCode
          value="https://halocard.ch/c/demo"
          size={120}
          aria-label="QR code vers la carte de démonstration"
        />
      </div>
      <p className="max-w-xs text-center text-sm text-galet-ink">
        <span className="font-semibold text-onyx">Essayez sur votre téléphone</span> — scannez,
        la carte de démonstration s&apos;installe en 30 secondes.
      </p>
    </div>
  );
}
