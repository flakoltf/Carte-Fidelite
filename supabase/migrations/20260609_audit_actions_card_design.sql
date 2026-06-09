-- Nouvelles actions d'audit pour l'éditeur de carte admin :
-- CARD_DESIGN_UPDATED (sauvegarde d'un design) et CARD_CLASS_SYNCED (sync Google Wallet).
-- Ces actions étaient écrites par le code (src/lib/auditLog.ts) mais absentes de la
-- contrainte CHECK posée par 20260604_admin_concierge.sql → les inserts étaient
-- silencieusement rejetés (logAuditEvent est best-effort, try/catch). On rétablit la
-- traçabilité en réémettant la contrainte complète (additive, aucune valeur retirée).

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action = ANY (ARRAY[
    'CARD_GENERATED', 'CARD_SCANNED', 'POINTS_INCREMENTED',
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'MERCHANT_CREATED', 'CUSTOMER_DELETED',
    'MERCHANT_UPDATED', 'MERCHANT_TOKEN_ROTATED', 'REWARD_REDEEMED',
    'CUSTOMER_UPDATED', 'MFA_ENROLLED', 'MFA_DISABLED',
    'ADMIN_IMPERSONATION_START', 'ADMIN_IMPERSONATION_STOP',
    'CARD_DESIGN_UPDATED', 'CARD_CLASS_SYNCED'
  ]));
