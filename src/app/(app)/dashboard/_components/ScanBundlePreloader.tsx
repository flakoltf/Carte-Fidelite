"use client";

import { useEffect } from "react";

// UXP-4 — Préchauffe le bundle caméra (`html5-qrcode`) dès l'affichage du
// comptoir, pendant que le marchand regarde ses 3 chiffres. Au tap « Scanner »,
// /dashboard/scan n'a alors plus qu'à démarrer la caméra : le module est déjà
// téléchargé, parsé et évalué → on supprime l'à-coup réseau+parse au moment
// critique.
//
// Gain attendu : `html5-qrcode` pèse ~80 Ko min+gz et son évaluation n'est pas
// triviale ; sur un réseau de comptoir typique (3G/4G partagé) le pré-chargement
// retire ~150–400 ms entre le tap et l'ouverture caméra (et davantage si le
// chunk n'était pas en cache). Combiné au `prefetch` du `<Link>`, le couple
// « route + bundle » est prêt avant l'intention de scan.
//
// Fire-and-forget : aucune erreur ne remonte à l'UI. Réseau coupé → on dégrade
// en silence, /dashboard/scan rechargera le module à la demande.
export default function ScanBundlePreloader() {
  useEffect(() => {
    void import("html5-qrcode").catch(() => {
      /* préchauffe best-effort : échec ignoré */
    });
  }, []);
  return null;
}
