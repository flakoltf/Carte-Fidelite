import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// CSP posée d'abord en Report-Only (ne bloque rien, signale les violations) : une CSP
// stricte enforcing nécessiterait des nonces (scripts inline d'hydratation Next) — à
// faire dans un second temps après validation. `connect-src` autorise Supabase + Sentry
// côté navigateur ; Upstash/Nominatim/Resend sont appelés côté serveur uniquement.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
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
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
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
          // Report-Only pour l'instant (cf. note CSP ci-dessus). À passer en
          // "Content-Security-Policy" (enforcing) avec nonces après validation.
          key: "Content-Security-Policy-Report-Only",
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
