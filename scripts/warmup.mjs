// Warmup non-bloquant du serveur de dev Next.js.
// Attend que le serveur réponde, puis déclenche la compilation à froid
// des routes lourdes en arrière-plan. Ne bloque jamais `next dev`.
//
// Usage : lancé en tâche de fond par le script `dev:warm`
//   node scripts/warmup.mjs & next dev --turbopack
//
// Config via env :
//   PORT          port du serveur de dev (défaut 3000)
//   WARMUP_ROUTES liste de routes séparées par des virgules (défaut /login,/admin,/)

const PORT = process.env.PORT || "3000";
const BASE = `http://localhost:${PORT}`;
const ROUTES = (process.env.WARMUP_ROUTES || "/login,/admin,/")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

const READY_TIMEOUT_MS = 120_000; // attente max que le serveur démarre
const POLL_INTERVAL_MS = 1_000; // intervalle entre deux tentatives
const COMPILE_TIMEOUT_MS = 180_000; // compile à froid : peut être lent

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "manual" });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function waitForServer() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fetchWithTimeout(BASE + "/", 2_000);
      return true; // une réponse (même 404/500) = le serveur écoute
    } catch {
      await sleep(POLL_INTERVAL_MS);
    }
  }
  return false;
}

async function warmRoute(route) {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(BASE + route, COMPILE_TIMEOUT_MS);
    const secs = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`[warmup] ${route} → ${res.status} en ${secs}s`);
  } catch {
    const secs = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`[warmup] ${route} → échec/timeout après ${secs}s`);
  }
}

(async () => {
  const up = await waitForServer();
  if (!up) {
    console.log(`[warmup] serveur injoignable sur ${BASE} — abandon.`);
    return;
  }
  console.log(`[warmup] serveur prêt sur ${BASE}, préchauffage de ${ROUTES.length} route(s)…`);
  // Séquentiel : évite de saturer le CPU avec plusieurs compilations à froid en parallèle.
  for (const route of ROUTES) {
    await warmRoute(route);
  }
  console.log("[warmup] terminé.");
})();
