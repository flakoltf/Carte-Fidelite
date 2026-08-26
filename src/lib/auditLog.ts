import { supabaseAdmin } from './supabaseAdmin';
import { clientIp } from './clientIp';

// Toute nouvelle action exige une migration jumelle de audit_logs_action_check
// (cf. supabase/migrations/20260610_audit_actions_card_design.sql) — le test
// __tests__/auditActionsSync.test.ts échoue sinon.
export const AUDIT_ACTIONS = [
  'CARD_GENERATED',
  'CARD_SCANNED',
  'POINTS_INCREMENTED',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'MERCHANT_CREATED',
  'CUSTOMER_DELETED',
  'MERCHANT_UPDATED',
  'MERCHANT_TOKEN_ROTATED',
  'REWARD_REDEEMED',
  'CUSTOMER_UPDATED',
  'MFA_ENROLLED',
  'MFA_DISABLED',
  'ADMIN_IMPERSONATION_START',
  'ADMIN_IMPERSONATION_STOP',
  'CARD_DESIGN_UPDATED',
  'CARD_CLASS_SYNCED',
  // Studio de design marchand + panneau super-admin — migration jumelle
  // FUSIONNÉE : supabase/migrations/20260612_audit_actions_merged.sql
  'CARD_DESIGN_DRAFT_SAVED',
  'CARD_DESIGN_PUBLISHED',
  'CARD_ASSET_UPLOADED',
  'MERCHANT_SUSPENDED',
  'MERCHANT_REACTIVATED',
  'MERCHANT_PLAN_CHANGED',
  'MERCHANT_LIMIT_ADJUSTED',
  'MERCHANT_BILLING_UPDATED',
  'MERCHANT_PASSWORD_RESET',
  'ADMIN_NOTE_ADDED',
  'ADMIN_NOTE_DELETED',
  'LEAD_CREATED',
  'LEAD_UPDATED',
  'LEAD_DELETED',
  'ADMIN_CUSTOMER_DATA_ACCESSED',
  'DATA_EXPORTED',
  'FEATURE_FLAG_UPDATED',
  'PLATFORM_SETTING_UPDATED',
  // Parcours self-service (Agent C) + cycle d'abonnement — migration jumelle :
  // supabase/migrations/20260613_audit_actions_self_service.sql
  // (SUBSCRIPTION_* figuraient déjà dans le CHECK depuis 20260610).
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SIGNUP_STARTED',
  'SIGNUP_EMAIL_VERIFIED',
  'MERCHANT_SELF_PROVISIONED',
  'ONBOARDING_COMPLETED',
  // Fork onboarding double parcours (self / concierge) — migration jumelle :
  // supabase/migrations/20260614_audit_actions_concierge.sql
  'ONBOARDING_MODE_SELECTED',
  'CONCIERGE_CARD_PROVISIONED',
  'CONCIERGE_DESIGN_DELIVERED',
  // Expérience guidée (annulation de tampon au comptoir) — migration jumelle :
  // supabase/migrations/20260615_audit_actions_guided.sql
  'SCAN_REVERTED',
  // Compte démo de prospection (seed/reset 1-clic) — migration jumelle :
  // supabase/migrations/20260618_audit_actions_demo.sql
  'DEMO_ACCOUNT_SEEDED',
  'DEMO_ACCOUNT_RESET',
  // Carte à points — expiration de cycle (cron quotidien) — migration jumelle :
  // supabase/migrations/20260826_audit_actions_points.sql
  'POINTS_EXPIRED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

interface AuditLogEntry {
  action: AuditAction;
  merchant_id?: string;
  user_id?: string;
  card_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

export async function logAuditEvent(entry: AuditLogEntry) {
  try {
    const { error } = await supabaseAdmin.from('audit_logs').insert({
      action: entry.action,
      merchant_id: entry.merchant_id,
      user_id: entry.user_id,
      card_id: entry.card_id,
      details: entry.details,
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
      created_at: new Date().toISOString(),
    });
    if (error) {
      // supabase-js ne throw pas : sans cette trace, une violation de CHECK
      // (action absente de audit_logs_action_check) est totalement invisible.
      console.error('Audit log rejected:', error.code, error.message, entry.action);
    }
  } catch (error) {
    // Log failures but don't break the main operation
    console.error('Audit log failed:', error);
  }
}

export function extractRequestMeta(req: Request): { ip_address: string; user_agent: string } {
  // IP de confiance (non spoofable via X-Forwarded-For) — alimente l'audit ET les clés
  // de rate-limit par IP (login-ip, enroll-ip, enroll-artifact).
  const ip_address = clientIp(req.headers);
  const user_agent = req.headers.get('user-agent') || 'unknown';
  return { ip_address, user_agent };
}
