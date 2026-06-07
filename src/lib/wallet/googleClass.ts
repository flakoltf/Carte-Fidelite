import { google } from 'googleapis';
import type { CardDesign } from '@/lib/cardDesign/types';
import { mapToGoogleClass } from '@/lib/cardDesign/mapGoogle';

// ---------------------------------------------------------------------------
// Auth helpers — mirrors the credential-reading pattern from googlePass.ts:
// GOOGLE_CREDENTIALS_JSON may be raw JSON or base64-encoded JSON.
// ---------------------------------------------------------------------------

function credentials() {
  const raw = process.env.GOOGLE_CREDENTIALS_JSON!;
  return JSON.parse(
    raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'),
  ) as { client_email: string; private_key: string };
}

function walletClient() {
  const creds = credentials();
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
  });
  return google.walletobjects({ version: 'v1', auth });
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Returns the fully-qualified LoyaltyClass id for a given merchant. */
export function classIdFor(merchantId: string): string {
  return `${process.env.GOOGLE_ISSUER_ID}.merchant_${merchantId.replace(/-/g, '')}`;
}

/**
 * Ensures the Google Wallet LoyaltyClass for `merchantId` exists and reflects
 * the current `design`.  Strategy: GET → if found PATCH-merge; if 404 INSERT.
 * Never uses a full UPDATE so existing fields not covered by `design` are kept.
 *
 * @returns The class id (e.g. "3388000000012345678.merchant_abc123").
 */
export async function ensureLoyaltyClass(
  merchantId: string,
  design: CardDesign,
  logoPublicUrl?: string,
  heroPublicUrl?: string,
): Promise<string> {
  const client = walletClient();
  const id = classIdFor(merchantId);
  const patch = mapToGoogleClass(design, logoPublicUrl, heroPublicUrl);

  try {
    // loyaltyclass.get / loyaltyclass.patch are on the prototype (non-enumerable).
    // Verified: prototype methods = [addmessage, get, insert, list, patch, update].
    await client.loyaltyclass.get({ resourceId: id });
    await client.loyaltyclass.patch({ resourceId: id, requestBody: patch });
  } catch (e: unknown) {
    const err = e as { code?: number; response?: { status?: number } };
    if (err?.code === 404 || err?.response?.status === 404) {
      await client.loyaltyclass.insert({
        requestBody: {
          id,
          issuerName: design.programName,
          reviewStatus: 'UNDER_REVIEW',
          ...patch,
        },
      });
    } else {
      throw e;
    }
  }

  return id;
}
