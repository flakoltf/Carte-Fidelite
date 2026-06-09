"use client";

import { useEffect } from "react";

// Enregistre le service worker (PWA installable). Inerte si l'API n'est pas dispo.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* enregistrement best-effort : on n'échoue jamais l'app */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);
  return null;
}
