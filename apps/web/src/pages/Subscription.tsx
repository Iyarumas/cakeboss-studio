import { useCallback, useEffect, useState } from 'react';
import { Check, CreditCard, Loader2, QrCode } from 'lucide-react';
import { supabase, type Plan } from '../lib/supabase';
import { useWorkspace } from '../cloud/WorkspaceGate';
import { PLANS, planPrice } from '@cakeboss/domain/plans';
import { Badge, Button, Card, CardHeader, PageHeader, cx } from '../components/ui';

type Sub = {
  plan: Plan;
  status: string;
  period_end: string | null;
  cancel_at_period_end: boolean;
  grant_expires_at: string | null;
  trial_ends_at: string | null;
} | null;
type BillingEvent = { id: string; kind: string; status: string; amount_cents: number | null; occurred_at: string; detail: Record<string, unknown> };

const day = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const when = (iso: string | null) => (iso ? day.format(new Date(iso)) : '');

/** The subscription state in plain words. Nothing here ever says "pago" unless the gateway confirmed a charge. */
function describe(s: Sub): { tone: 'green' | 'amber' | 'red' | 'gray' | 'lilac'; label: string; text: string } {
  if (!s) return { tone: 'gray', label: 'Sem plano', text: 'Escolha um plano para usar o painel.' };
  switch (s.status) {
    case 'test_grant':
      return { tone: 'lilac', label: 'Liberado pela equipe', text: s.grant_expires_at ? `Acesso liberado pela equipe CakeBoss até ${when(s.grant_expires_at)}. Nada foi cobrado.` : 'Acesso liberado pela equipe CakeBoss enquanto a cobrança não começa. Nada foi cobrado.' };
    case 'trialing':
      return { tone: 'lilac', label: 'Teste grátis', text: `Teste grátis até ${when(s.trial_ends_at)}. A primeira mensalidade é cobrada no cartão nesse dia, se você não cancelar antes.` };
    case 'active':
      return { tone: 'green', label: 'Ativo', text: s.cancel_at_period_end ? `Cancelado: o acesso continua até ${when(s.period_end)}.` : s.period_end ? `Pago até ${when(s.period_end)}.` : 'Assinatura ativa.' };
    case 'past_due':
      return { tone: 'red', label: 'Pagamento pendente', text: 'A última cobrança não foi aprovada. Confira o cartão no Mercado Pago para não perder o acesso.' };
    case 'pending_payment':
      return { tone: 'amber', label: 'Aguardando pagamento', text: 'Falta concluir o pagamento para liberar o plano.' };
    default:
      return { tone: 'amber', label: 'Plano escolhido', text: 'As assinaturas do CakeBoss abrem em breve. Quando a cobrança começar, você cadastra o cartão ou paga no Pix e o plano é liberado.' };
  }
}

/** Sends the owner to the gateway's own checkout (card or Pix). Card data never touches CakeBoss. */
export function PayButtons({ workspaceId, trialDays, onMessage }: { workspaceId: string; trialDays: number; onMessage: (m: string) => void }) {
  const [busy, setBusy] = useState<'card' | 'pix' | null>(null);
  const pay = async (method: 'card' | 'pix') => {
    setBusy(method);
    const { data, error } = await supabase.functions.invoke('billing/checkout', { body: { workspace_id: workspaceId, method } });
    setBusy(null);
    const r = data as { status?: string; url?: string; error?: string } | null;
    if (r?.status === 'redirect' && r.url) return window.location.assign(r.url);
    if (r?.status === 'billing_not_configured') return onMessage('A cobrança ainda não começou. Seu plano fica guardado e avisamos quando abrir.');
    onMessage(r?.error ?? (error ? 'Não foi possível abrir o pagamento agora. Tente de novo em instantes.' : 'Não foi possível abrir o pagamento.'));
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" disabled={!!busy} onClick={() => void pay('card')}>
        {busy === 'card' ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
        {trialDays > 0 ? `Cadastrar cartão · ${trialDays} dias grátis` : 'Pagar com cartão'}
      </Button>
      <Button disabled={!!busy} onClick={() => void pay('pix')}>
        {busy === 'pix' ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
        Pagar 1 mês no Pix
      </Button>
    </div>
  );
}

const KIND: Record<string, string> = { charge: 'Cobrança', refund: 'Reembolso', renewal: 'Renovação', upgrade: 'Troca de plano', downgrade: 'Troca de plano', cancel: 'Cancelamento', grant: 'Liberação', status_change: 'Mudança' };
const EVENT_STATUS: Record<string, { label: string; tone: 'green' | 'red' | 'amber' | 'gray' }> = {
  approved: { label: 'Aprovada', tone: 'green' },
  rejected: { label: 'Recusada', tone: 'red' },
  pending: { label: 'Pendente', tone: 'amber' },
  refunded: { label: 'Reembolsada', tone: 'gray' },
  info: { label: 'Registro', tone: 'gray' },
};

export default function SubscriptionPage() {
  const ws = useWorkspace();
  const [sub, setSub] = useState<Sub>(null);
  const [billing, setBilling] = useState<{ enabled: boolean; trial_days: number } | null>(null);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const [access, info, ev] = await Promise.all([
      supabase.rpc('my_workspace_access', { ws: ws.id }),
      supabase.rpc('billing_info'),
      supabase.from('billing_events').select('id, kind, status, amount_cents, occurred_at, detail').eq('workspace_id', ws.id).order('occurred_at', { ascending: false }).limit(20),
    ]);
    setSub(((access.data as { subscription?: Sub } | null)?.subscription ?? null) as Sub);
    setBilling((info.data as { enabled: boolean; trial_days: number } | null) ?? { enabled: false, trial_days: 0 });
    setEvents((ev.data as BillingEvent[] | null) ?? []);
    setLoading(false);
  }, [ws.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const d = describe(sub);
  const current = sub?.plan ?? null;
  const awaiting = sub?.status === 'pending_payment';
  const neverTrialed = !sub?.trial_ends_at;

  return (
    <div>
      <PageHeader title="Plano e assinatura" subtitle="O plano da sua confeitaria, o que ele libera e as cobranças." />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="grid gap-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted">Plano atual</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-2xl font-bold tracking-tight">{current ? PLANS.find((p) => p.code === current)?.name : 'Nenhum'}</span>
                  <Badge tone={d.tone}>{d.label}</Badge>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-muted">{d.text}</p>
              </div>
              {current && <div className="text-right text-2xl font-bold tabular">{planPrice(PLANS.find((p) => p.code === current)?.priceCents ?? 0)}<span className="text-sm font-medium text-muted"> /mês</span></div>}
            </div>
            {awaiting && billing?.enabled && (
              <div className="border-t border-divider p-5">
                <PayButtons workspaceId={ws.id} trialDays={current === 'basico' && neverTrialed ? billing.trial_days : 0} onMessage={setMessage} />
                <p className="mt-2 text-xs text-muted">O pagamento abre no Mercado Pago. O CakeBoss não vê nem guarda os dados do seu cartão.</p>
              </div>
            )}
          </Card>

          {message && (
            <p role="status" className="rounded-lg border border-line bg-subtle px-3 py-2.5 text-sm">
              {message}
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            {PLANS.map((p) => {
              const isCurrent = p.code === current;
              return (
                <Card key={p.code} className={cx('flex flex-col p-5', isCurrent && 'border-pink')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-bold">{p.name}</span>
                    {isCurrent && (
                      <Badge tone="pink">
                        <Check size={12} /> Seu plano
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-2xl font-extrabold tabular">
                    {planPrice(p.priceCents)}
                    <span className="text-sm font-medium text-muted"> /mês</span>
                  </div>
                  <p className="mt-2 text-sm">{p.forWho}</p>
                  <p className="mt-2 flex-1 text-xs text-muted">{p.includes}</p>
                  {!isCurrent && (
                    <p className="mt-4 text-xs text-muted">
                      {billing?.enabled ? 'Para trocar de plano, fale com o suporte do CakeBoss.' : 'A troca de plano abre junto com a cobrança.'}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader title="Cobranças e registros" subtitle="O que aconteceu com a sua assinatura" />
            {events.length === 0 ? (
              <p className="p-5 text-sm text-muted">Nenhuma cobrança até agora.</p>
            ) : (
              <ul className="divide-y divide-divider">
                {events.map((e) => {
                  const st = EVENT_STATUS[e.status] ?? EVENT_STATUS.info;
                  return (
                    <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                      <span className="w-40 shrink-0 text-muted">{when(e.occurred_at)}</span>
                      <span className="min-w-0 flex-1">{KIND[e.kind] ?? 'Registro'}</span>
                      {e.amount_cents ? <span className="tabular">{planPrice(e.amount_cents)}</span> : null}
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
