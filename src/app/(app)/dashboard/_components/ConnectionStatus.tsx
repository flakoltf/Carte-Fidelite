"use client";

import { useEffect, useState } from "react";

// Pastille de connexion temps réel du footer comptoir : vert = en ligne, rouge =
// hors ligne. Au comptoir, le marchand doit voir d'un coup d'œil si un scan
// partira. Rendu serveur initial optimiste (vert) puis corrigé côté client.
export default function ConnectionStatus({ version }: { version: string }) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <div className="flex items-center justify-center gap-2 text-[11px] text-galet">
      <span
        role="status"
        aria-label={online ? "Connexion active" : "Hors ligne"}
        className={`inline-block h-2 w-2 rounded-full ${
          online ? "bg-halo-glow animate-pulse" : "bg-red-500"
        }`}
      />
      <span>{online ? "Connecté" : "Hors ligne"}</span>
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">{version}</span>
    </div>
  );
}
