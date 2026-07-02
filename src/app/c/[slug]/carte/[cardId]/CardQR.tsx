"use client";

import QRCode from "react-qr-code";

// QR de la carte web de repli — même payload que le code-barres du pass
// (signé côté serveur), rendu en SVG dans un cadre blanc pour le scan.
export default function CardQR({ value }: { value: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-line-warm">
      <QRCode value={value} size={200} aria-label="QR code de votre carte de fidélité" />
    </div>
  );
}
