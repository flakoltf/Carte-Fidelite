// Init Sentry côté serveur (runtime Node.js). Chargé par src/instrumentation.ts.
import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/lib/monitoring/sentryOptions";

Sentry.init({ ...baseSentryOptions });
