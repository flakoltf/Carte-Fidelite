// Init Sentry côté navigateur. Utilise NEXT_PUBLIC_SENTRY_DSN (variable publique).
import * as Sentry from "@sentry/nextjs";
import { baseSentryOptions } from "@/lib/monitoring/sentryOptions";

Sentry.init({ ...baseSentryOptions });

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
