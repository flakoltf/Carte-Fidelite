import { supabaseAdmin } from './supabaseAdmin';

export type AuditAction =
  | 'CARD_GENERATED'
  | 'CARD_SCANNED'
  | 'POINTS_INCREMENTED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'MERCHANT_CREATED'
  | 'CUSTOMER_DELETED'
  | 'MERCHANT_UPDATED'
  | 'MERCHANT_TOKEN_ROTATED'
  | 'REWARD_REDEEMED'
  | 'CUSTOMER_UPDATED';

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
    await supabaseAdmin.from('audit_logs').insert({
      action: entry.action,
      merchant_id: entry.merchant_id,
      user_id: entry.user_id,
      card_id: entry.card_id,
      details: entry.details,
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // Log failures but don't break the main operation
    console.error('Audit log failed:', error);
  }
}

export function extractRequestMeta(req: Request): { ip_address: string; user_agent: string } {
  const xff = req.headers.get('x-forwarded-for');
  const ip_address = xff?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const user_agent = req.headers.get('user-agent') || 'unknown';
  return { ip_address, user_agent };
}
