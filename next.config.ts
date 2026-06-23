import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// ─────────────────────────────────────────────────────────────────────────────
// FILET DE BUILD — environnements NON-production (Preview Vercel + build local)
// ─────────────────────────────────────────────────────────────────────────────
// Cause racine des builds preview KO (vérifiée dans les logs Vercel, PAS le warning
// Turbopack NFT qui n'est qu'un bruit non-bloquant — la compilation réussit) :
// plusieurs modules instancient leur client AU CHARGEMENT DU MODULE et JETTENT si la
// variable d'env manque —
//   • src/lib/supabaseAdmin.ts : NEXT_PUBLIC_SUPABASE_URL! + SUPABASE_SERVICE_ROLE_KEY!
//   • src/lib/supabase.ts      : NEXT_PUBLIC_SUPABASE_URL! + NEXT_PUBLIC_SUPABASE_ANON_KEY!
//   • src/lib/redis.ts         : throw + Redis.fromEnv() (UPSTASH_REDIS_REST_URL/TOKEN)
//   • src/lib/qrSignature.ts   : throw si QR_SIGNATURE_SECRET absent
// À l'étape « Collecting page data », le build importe ces modules. L'environnement
// Preview ne disposant pas de ces variables (elles ne sont définies que pour
// Production), tous les builds preview échouaient sur « Error: supabaseUrl is required ».
//
// next.config.ts s'exécute DANS le process de build : muter process.env ici fournit
// les variables à la fois aux accès directs (`process.env.X`) et aux lectures runtime
// (`Redis.fromEnv()`). On n'injecte que des PLACEHOLDERS NON-SECRETS, et UNIQUEMENT
// pour les variables ABSENTES — donc jamais d'écrasement d'une vraie valeur. En
// PRODUCTION ce filet est désactivé : une variable manquante DOIT faire échouer le
// build (fail-closed). Les previews construisent alors au vert ; leur runtime n'a pas
// d'accès BD/Redis réel (placeholders) — ce qui est l'effet voulu (un preview ne doit
// pas écrire en base de prod). Pour des previews pleinement fonctionnels, définir ces
// variables sur l'environnement « Preview » dans Vercel (cf. description de la PR).
if (process.env.VERCEL_ENV !== "production") {
  const buildFallbacks: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: "https://preview-build-placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "preview-build-placeholder-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "preview-build-placeholder-service-key",
    UPSTASH_REDIS_REST_URL: "https://preview-build-placeholder.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "preview-build-placeholder-token",
    QR_SIGNATURE_SECRET: "preview-build-placeholder-qr-signature-secret",
  };
  for (const [key, value] of Object.entries(buildFallbacks)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT SECURITY POLICY — ENFORCING (sans nonce)
// ─────────────────────────────────────────────────────────────────────────────
// Les nonces exigeraient le middleware `proxy.ts` (hors périmètre de ce PR d'infra)
// et forceraient un rendu 100% dynamique (perte du statique/PPR, surcoût serveur —
// cf. node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// On suit donc l'approche officielle « Without Nonces » de Next : `script-src` et
// `style-src` autorisent 'unsafe-inline' (les scripts d'hydratation Next sont inline
// et sans nonce — vérifié : 6 <script> inline sur la prod, aucun nonce). 'unsafe-eval'
// uniquement en dev (React l'emploie pour les stacktraces ; inutile en prod).
// Le durcissement réel est conservé et désormais APPLIQUÉ (plus seulement signalé) :
// object-src 'none', base-uri 'self', frame-ancestors 'none' (anti-clickjacking),
// form-action 'self', default-src 'self', connect-src restreint (Supabase + Sentry),
// upgrade-insecure-requests.
// Étape suivante possible pour retirer 'unsafe-inline' des scripts : nonce via proxy.ts,
// ou `experimental.sri` (hash-based, expérimental) — délibérément différé.
const isDev = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.20.10.9", "localhost:3000"],
  turbopack: {
    root: process.cwd(),
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          // HSTS 2 ans + preload (éligibilité liste de préchargement HSTS des
          // navigateurs). Engagement fort : tous les sous-domaines doivent rester
          // en HTTPS, la sortie de la liste est lente — cf. description de la PR.
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-XSS-Protection",
          value: "1; mode=block",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          // ENFORCING (auparavant Report-Only). Voir la note CSP ci-dessus.
          key: "Content-Security-Policy",
          value: CSP,
        },
        {
          // camera autorisée (scanner /scan utilise getUserMedia) ; reste refusé.
          key: "Permissions-Policy",
          value: "camera=(self), microphone=(), geolocation=(), payment=()",
        },
      ],
    },
    // SEO : un seul hôte indexable (halocard.ch). L'app et les déploiements
    // Vercel servent le même contenu — on les exclut de l'index.
    {
      source: "/(.*)",
      has: [{ type: "host", value: "app.halocard.ch" }],
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
    {
      source: "/(.*)",
      has: [{ type: "host", value: "(?<vhost>.*\\.vercel\\.app)" }],
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
  ],
};

// withSentryConfig : l'upload des source maps ne s'active que si SENTRY_AUTH_TOKEN
// + org/project sont définis ; sinon le build reste normal (aucun blocage).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
