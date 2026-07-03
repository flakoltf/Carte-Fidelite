"use client";

import QRCode from "react-qr-code";

// « Essayez sur votre téléphone » — l'argument n°1 du produit (scanner → carte
// dans le téléphone, sans appli) doit être vivable depuis le site : ce QR mène
// à l'enrôlement réel de la boutique de démonstration.
// Titre/texte et alignement surchargables (configurateur de la landing) ; les
// défauts préservent les usages existants (/exemples, /demarrer). En `left`,
// le titre est empilé au-dessus du texte (maquette 2a) au lieu du tiret inline.
export default function TryItQR({
  title = "Essayez sur votre téléphone",
  description = "scannez, la carte de démonstration s'installe en 30 secondes.",
  align = "center",
}: {
  title?: string;
  description?: string;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <div className={`flex flex-col gap-3.5 ${centered ? "items-center" : "items-start"}`}>
      <div className="rounded-2xl border border-line-warm bg-white p-3">
        <QRCode
          value="https://halocard.ch/c/demo"
          size={120}
          aria-label="QR code vers la carte de démonstration"
        />
      </div>
      <p className={`max-w-xs text-sm leading-relaxed text-galet-ink ${centered ? "text-center" : "text-left"}`}>
        <span className="font-semibold text-onyx">{title}</span>
        {centered ? " — " : <br />}
        {description}
      </p>
    </div>
  );
}
