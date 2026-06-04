// Init Sentry côté edge (middleware, routes edge). Chargé par src/instrumentation.ts.
import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/lib/monitoring/sentryOptions";

Sentry.init({ ...baseSentryOptions });
