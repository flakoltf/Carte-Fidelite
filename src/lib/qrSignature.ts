import crypto from 'crypto';
import { timingSafeEqualStr } from './timingSafe';

if (!process.env.QR_SIGNATURE_SECRET) {
  throw new Error('QR_SIGNATURE_SECRET is required. Set it in your environment.');
}
const QR_SECRET_KEY = process.env.QR_SIGNATURE_SECRET;

// Ancienne signature tronquée (64 bits) — encore présente dans les QR déjà émis
// (cartes Wallet installées). Acceptée en lecture pour ne pas casser ces cartes ;
// les nouveaux pass utilisent la signature complète. À retirer une fois la migration
// des pass terminée.
const LEGACY_SIG_LEN = 16;

function fullSignature(cardId: string): string {
  return crypto.createHmac('sha256', QR_SECRET_KEY).update(cardId).digest('hex'); // 64 hex (256 bits)
}

export function signQRCode(cardId: string): string {
  return `${cardId}:${fullSignature(cardId)}`;
}

export function verifyQRCode(qrContent: string): { valid: boolean; cardId: string | null } {
  const idx = qrContent.indexOf(':');
  if (idx <= 0) return { valid: false, cardId: null };
  const cardId = qrContent.slice(0, idx);
  const signature = qrContent.slice(idx + 1);
  if (!cardId || !signature) return { valid: false, cardId: null };

  const expected = fullSignature(cardId);
  // Signature complète (nouvelle) OU tronquée 16-car (ancienne, rétro-compat), en temps constant.
  const ok =
    timingSafeEqualStr(signature, expected) ||
    timingSafeEqualStr(signature, expected.slice(0, LEGACY_SIG_LEN));

  return ok ? { valid: true, cardId } : { valid: false, cardId: null };
}
