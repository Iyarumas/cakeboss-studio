/**
 * CakeBoss · Edge Function `billing` — cobrança das assinaturas do CakeBoss (não das lojas).
 *
 *   POST /billing/checkout  { workspace_id, method: 'card' | 'pix' }   (pessoa logada, gestora da confeitaria)
 *        → { status: 'billing_not_configured' } enquanto a cobrança estiver desligada
 *        → { status: 'redirect', url } com o checkout oficial do gateway (nenhum dado de cartão passa por aqui)
 *   POST /billing/webhook   avisos do Mercado Pago, com assinatura conferida; o estado é sempre relido na API dele
 *
 * Variáveis (painel do Supabase → Edge Functions → Secrets), nunca no app:
 *   MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, APP_URL (ex.: https://cakeboss.com.br)
 *   SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já vêm do Supabase.
 * Implante com `--no-verify-jwt`: o webhook não tem login; o checkout confere o login aqui dentro.
 */
import { addMonth, cardFingerprint, chargeStatus, preapprovalStatus, verifyMercadoPagoSignature } from './logic.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = env('SUPABASE_ANON_KEY');
const MP = 'https://api.mercadopago.com';

const cors = {
  'Access-Control-Allow-Origin': env('APP_URL') || '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Server-only database functions (granted to service_role only). */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

async function mp<T>(path: string, init?: RequestInit & { idempotencyKey?: string }): Promise<T> {
  const r = await fetch(`${MP}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env('MP_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
      ...(init?.idempotencyKey ? { 'X-Idempotency-Key': init.idempotencyKey } : {}),
    },
  });
  if (!r.ok) throw new Error(`Mercado Pago ${path}: ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

/** Who is calling, from their own login token (never from the request body). */
async function currentUser(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: auth } });
  if (!r.ok) return null;
  return ((await r.json()) as { id?: string }).id ?? null;
}

type Prepared =
  | { status: 'billing_not_configured' }
  | { status: 'pending_payment'; subscription_id: string; plan: string; plan_name: string; price_cents: number; provider: 'mercadopago' | 'stripe' | null; trial_days: number; email: string };

async function checkout(req: Request): Promise<Response> {
  const uid = await currentUser(req);
  if (!uid) return json({ error: 'Entre na sua conta para continuar.' }, 401);
  const body = (await req.json().catch(() => ({}))) as { workspace_id?: string; method?: string };
  if (!body.workspace_id || (body.method !== 'card' && body.method !== 'pix')) return json({ error: 'Pedido inválido.' }, 400);

  const p = await rpc<Prepared>('billing_prepare_checkout', { ws: body.workspace_id, uid, method: body.method });
  if (p.status === 'billing_not_configured') return json(p);
  if (p.provider !== 'mercadopago') return json({ error: 'Este meio de cobrança ainda não está disponível.' }, 501);
  if (!env('MP_ACCESS_TOKEN')) return json({ status: 'billing_not_configured' });

  const amount = p.price_cents / 100;
  const back = `${env('APP_URL')}/plano`;
  const notify = `${SUPABASE_URL}/functions/v1/billing/webhook`;

  if (body.method === 'card') {
    // assinatura mensal no cartão; o teste do Básico é o "free_trial" do próprio Mercado Pago
    const pre = await mp<{ id: string; init_point: string }>('/preapproval', {
      method: 'POST',
      idempotencyKey: `sub-${p.subscription_id}-card`,
      body: JSON.stringify({
        reason: `CakeBoss · plano ${p.plan_name}`,
        external_reference: p.subscription_id,
        payer_email: p.email,
        back_url: back,
        notification_url: notify,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: amount,
          currency_id: 'BRL',
          ...(p.trial_days > 0 ? { free_trial: { frequency: p.trial_days, frequency_type: 'days' } } : {}),
        },
      }),
    });
    await rpc('billing_attach', { sub: p.subscription_id, prov: 'mercadopago', provider_sub_id: pre.id });
    return json({ status: 'redirect', url: pre.init_point });
  }

  // Pix: paga um mês agora, sem teste
  const pref = await mp<{ init_point: string }>('/checkout/preferences', {
    method: 'POST',
    idempotencyKey: `sub-${p.subscription_id}-pix-${new Date().toISOString().slice(0, 10)}`,
    body: JSON.stringify({
      items: [{ title: `CakeBoss · plano ${p.plan_name} · 1 mês`, quantity: 1, unit_price: amount, currency_id: 'BRL' }],
      external_reference: p.subscription_id,
      payer: { email: p.email },
      payment_methods: { excluded_payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }, { id: 'ticket' }], installments: 1 },
      back_urls: { success: back, pending: back, failure: back },
      auto_return: 'approved',
      notification_url: notify,
    }),
  });
  return json({ status: 'redirect', url: pref.init_point });
}

type Preapproval = { id: string; status: string; external_reference: string; payer_id?: number; card_id?: number; next_payment_date?: string; auto_recurring?: { free_trial?: unknown } };

async function webhook(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; action?: string; data?: { id?: string } };
  const dataId = url.searchParams.get('data.id') ?? body.data?.id ?? null;
  const type = url.searchParams.get('type') ?? body.type ?? '';
  const ok = await verifyMercadoPagoSignature({
    secret: env('MP_WEBHOOK_SECRET'),
    signature: req.headers.get('x-signature'),
    requestId: req.headers.get('x-request-id'),
    dataId,
    nowSeconds: Date.now() / 1000,
  });
  if (!ok) return json({ error: 'assinatura inválida' }, 401);
  if (!dataId) return json({ ignored: true });
  const eventId = `${type}:${dataId}:${req.headers.get('x-request-id') ?? ''}`;

  if (type === 'subscription_preapproval') {
    const pre = await mp<Preapproval>(`/preapproval/${dataId}`);
    // cartão aceito numa assinatura com teste: o teste começa (uma vez por cartão)
    if (pre.status === 'authorized' && pre.auto_recurring?.free_trial && pre.payer_id && pre.card_id) {
      const card = await mp<Parameters<typeof cardFingerprint>[0]>(`/v1/customers/${pre.payer_id}/cards/${pre.card_id}`).catch(() => null);
      const fp = card && cardFingerprint(card);
      if (fp) await rpc('billing_start_trial', { sub: pre.external_reference, prov: 'mercadopago', card_fingerprint: fp, provider_sub_id: pre.id });
      return json({ ok: true });
    }
    const status = preapprovalStatus(pre.status);
    if (status) await rpc('billing_apply', { sub: pre.external_reference, prov: 'mercadopago', event_id: `${eventId}:${pre.status}`, new_status: status, period_end: null, amount_cents: null, transaction_id: null, kind: status === 'canceled' ? 'cancel' : 'status_change', detail: { preapproval: pre.status } });
    return json({ ok: true });
  }

  if (type === 'subscription_authorized_payment') {
    const pay = await mp<{ id: number; preapproval_id: string; status: string; transaction_amount: number; payment?: { id?: number; status?: string } }>(`/authorized_payments/${dataId}`);
    const pre = await mp<Preapproval>(`/preapproval/${pay.preapproval_id}`);
    const status = chargeStatus(pay.payment?.status ?? pay.status);
    if (status) {
      await rpc('billing_apply', {
        sub: pre.external_reference, prov: 'mercadopago', event_id: `authorized_payment:${pay.id}:${status}`, new_status: status,
        period_end: status === 'active' ? (pre.next_payment_date ?? addMonth(new Date()).toISOString()) : null,
        amount_cents: status === 'active' ? Math.round(pay.transaction_amount * 100) : null,
        transaction_id: String(pay.payment?.id ?? pay.id), kind: 'charge', detail: { cobranca: pay.status },
      });
    }
    return json({ ok: true });
  }

  if (type === 'payment') {
    const pay = await mp<{ id: number; status: string; transaction_amount: number; external_reference?: string; payment_type_id?: string }>(`/v1/payments/${dataId}`);
    const status = chargeStatus(pay.status);
    // só o Pix da assinatura (as cobranças do cartão chegam como authorized_payment)
    if (status === 'active' && pay.external_reference && pay.payment_type_id === 'bank_transfer') {
      await rpc('billing_apply', {
        sub: pay.external_reference, prov: 'mercadopago', event_id: `payment:${pay.id}:approved`, new_status: 'active',
        period_end: addMonth(new Date()).toISOString(), amount_cents: Math.round(pay.transaction_amount * 100),
        transaction_id: String(pay.id), kind: 'charge', detail: { pix: pay.status },
      });
    }
    return json({ ok: true });
  }

  return json({ ignored: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405);
  const path = new URL(req.url).pathname;
  try {
    if (path.endsWith('/checkout')) return await checkout(req);
    if (path.endsWith('/webhook')) return await webhook(req);
    return json({ error: 'não encontrado' }, 404);
  } catch (e) {
    console.error(e);
    // sem detalhes internos para quem chamou
    return json({ error: 'Não foi possível concluir agora. Tente de novo em instantes.' }, 500);
  }
});
