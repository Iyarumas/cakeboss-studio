import { describe, expect, it } from 'vitest';
import { addMonth, cardFingerprint, chargeStatus, preapprovalStatus, verifyMercadoPagoSignature } from './logic';

async function sign(secret: string, manifest: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(manifest));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('assinatura dos avisos do Mercado Pago', () => {
  const secret = 'segredo-de-teste';
  const now = 1_800_000_000;
  const ts = String(now * 1000);

  it('aceita aviso assinado com o segredo certo', async () => {
    const v1 = await sign(secret, `id:abc123;request-id:req-1;ts:${ts};`);
    expect(await verifyMercadoPagoSignature({ secret, signature: `ts=${ts},v1=${v1}`, requestId: 'req-1', dataId: 'ABC123', nowSeconds: now })).toBe(true);
  });

  it('recusa assinatura errada, sem cabeçalho ou com outro id', async () => {
    const v1 = await sign('outro', `id:abc123;request-id:req-1;ts:${ts};`);
    expect(await verifyMercadoPagoSignature({ secret, signature: `ts=${ts},v1=${v1}`, requestId: 'req-1', dataId: 'abc123', nowSeconds: now })).toBe(false);
    expect(await verifyMercadoPagoSignature({ secret, signature: null, requestId: 'req-1', dataId: 'abc123', nowSeconds: now })).toBe(false);
    const ok = await sign(secret, `id:abc123;request-id:req-1;ts:${ts};`);
    expect(await verifyMercadoPagoSignature({ secret, signature: `ts=${ts},v1=${ok}`, requestId: 'req-1', dataId: 'zzz999', nowSeconds: now })).toBe(false);
  });

  it('recusa aviso antigo (reenvio de aviso capturado)', async () => {
    const v1 = await sign(secret, `id:abc123;request-id:req-1;ts:${ts};`);
    expect(await verifyMercadoPagoSignature({ secret, signature: `ts=${ts},v1=${v1}`, requestId: 'req-1', dataId: 'abc123', nowSeconds: now + 3600 })).toBe(false);
  });

  it('recusa quando o segredo não está configurado', async () => {
    expect(await verifyMercadoPagoSignature({ secret: '', signature: `ts=${ts},v1=00`, requestId: null, dataId: null, nowSeconds: now })).toBe(false);
  });
});

describe('estados vindos do gateway', () => {
  it('cartão aceito não libera acesso sozinho; só a cobrança aprovada', () => {
    expect(preapprovalStatus('authorized')).toBeNull();
    expect(preapprovalStatus('cancelled')).toBe('canceled');
    expect(chargeStatus('approved')).toBe('active');
    expect(chargeStatus('rejected')).toBe('past_due');
    expect(chargeStatus('pending')).toBeNull();
    expect(chargeStatus('in_process')).toBeNull();
  });

  it('próximo mês respeita meses curtos', () => {
    expect(addMonth(new Date('2026-01-31T12:00:00Z')).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(addMonth(new Date('2026-11-01T12:00:00Z')).toISOString().slice(0, 10)).toBe('2026-12-01');
  });

  it('identifica o cartão para o teste grátis valer uma vez só', () => {
    expect(cardFingerprint({ first_six_digits: '503143', last_four_digits: '6351', expiration_month: 11, expiration_year: 2030 })).toBe('503143|6351|11|2030|');
    expect(cardFingerprint({ last_four_digits: '6351' })).toBeNull();
  });
});
