/**
 * Pure rules of the CakeBoss subscription billing, kept apart from Deno and the network so they can be
 * tested (logic.test.ts). Used by the `billing` Edge Function.
 */

export type SubStatus = 'active' | 'past_due' | 'canceled' | 'expired' | 'pending_payment';

const enc = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of two hex strings. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Mercado Pago webhook signature (header `x-signature: ts=…,v1=…` and `x-request-id`).
 * The signed text is `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, leaving out parts that are missing.
 * Notices older than `maxAgeSeconds` are refused so a captured notice can't be replayed later.
 */
export async function verifyMercadoPagoSignature(opts: {
  secret: string;
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
  nowSeconds: number;
  maxAgeSeconds?: number;
}): Promise<boolean> {
  if (!opts.secret || !opts.signature) return false;
  const parts = Object.fromEntries(
    opts.signature.split(',').map((p) => {
      const [k, ...v] = p.split('=');
      return [k.trim(), v.join('=').trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  // ts comes in milliseconds
  const age = opts.nowSeconds - Number(ts) / 1000;
  if (!Number.isFinite(age) || Math.abs(age) > (opts.maxAgeSeconds ?? 600)) return false;
  // alphanumeric ids are signed in lowercase
  const id = opts.dataId ? (/^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId) : null;
  let manifest = '';
  if (id) manifest += `id:${id};`;
  if (opts.requestId) manifest += `request-id:${opts.requestId};`;
  manifest += `ts:${ts};`;
  return sameHex(await hmacHex(opts.secret, manifest), v1.toLowerCase());
}

/** A Mercado Pago subscription (preapproval) status, read from its API, as our subscription status. */
export function preapprovalStatus(s: string): SubStatus | null {
  if (s === 'cancelled') return 'canceled';
  if (s === 'paused') return 'past_due';
  // 'authorized' only means the card was accepted: access opens with the first approved charge (or the trial)
  return null;
}

/** A charge on a card subscription (authorized_payment) or a one-off Pix payment, as our subscription status. */
export function chargeStatus(s: string): SubStatus | null {
  if (s === 'approved' || s === 'processed') return 'active';
  if (s === 'rejected' || s === 'recycling') return 'past_due';
  return null;
}

/** One month after `from`, keeping the day when it exists (31 Jan → 28/29 Feb). */
export function addMonth(from: Date): Date {
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/**
 * What identifies a card for the one-trial-per-card rule. Mercado Pago has no card fingerprint, so we
 * combine what it returns about the card; only a hash of this is stored (private.trial_fingerprints).
 */
export function cardFingerprint(c: { first_six_digits?: string; last_four_digits?: string; expiration_month?: number; expiration_year?: number; cardholder?: { identification?: { number?: string } } }): string | null {
  if (!c.first_six_digits || !c.last_four_digits) return null;
  return [c.first_six_digits, c.last_four_digits, c.expiration_month ?? '', c.expiration_year ?? '', c.cardholder?.identification?.number ?? ''].join('|');
}
