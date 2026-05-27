import crypto from 'crypto';

if (!process.env.QR_SIGNATURE_SECRET) {
  throw new Error('QR_SIGNATURE_SECRET is required. Set it in your environment.');
}
const QR_SECRET_KEY = process.env.QR_SIGNATURE_SECRET;

export function signQRCode(cardId: string): string {
  const hmac = crypto.createHmac('sha256', QR_SECRET_KEY);
  const signature = hmac.update(cardId).digest('hex').slice(0, 16);
  return `${cardId}:${signature}`;
}

export function verifyQRCode(qrContent: string): { valid: boolean; cardId: string | null } {
  const [cardId, signature] = qrContent.split(':');

  if (!cardId || !signature) {
    return { valid: false, cardId: null };
  }

  const expectedSignature = signQRCode(cardId).split(':')[1];

  if (signature !== expectedSignature) {
    return { valid: false, cardId: null };
  }

  return { valid: true, cardId };
}
