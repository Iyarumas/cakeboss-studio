import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Check, Copy, CreditCard, MessageCircle, QrCode, Store, Truck, Wallet } from 'lucide-react';
import { useStore } from '../store/store';
import { fromLocalDateTime, money, nowIso, uid } from '@cakeboss/domain/format';
import { activeZones, addressLine, addressMissing, allowedPayments, earliestDate, emptyAddress, storeSettings } from '@cakeboss/domain/shop';
import { normalizePhone, waLink } from '@cakeboss/domain/whatsapp';
import type { Address, Order, PaymentMethod } from '@cakeboss/domain/types';
import { Button, Field, Segmented, Select, TextInput, cx } from '../components/ui';
import { useToast } from '../components/motion';
import { AddressFields } from './AuthDialog';
import { QtyStepper, Section, useCartLines, useShop } from './ShopApp';

const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const METHOD_ICON: Record<string, typeof QrCode> = { pix: QrCode, credito: CreditCard, dinheiro: Wallet };

export default function Checkout() {
  const { db, saveOrder, saveCustomer } = useStore();
  const { setQty, clearCart, account, customer, requireLogin } = useShop();
  const navigate = useNavigate();
  const toast = useToast();
  const st = storeSettings(db.settings);
  const zones = activeZones(st);

  const [type, setType] = useState<'entrega' | 'retirada'>(zones.length ? 'entrega' : 'retirada');
  const [address, setAddress] = useState<Address>(() => (customer?.address && zones.some((z) => z.city === customer.address!.city) ? customer.address : emptyAddress(zones[0]?.city ?? '')));
  const [saveAddress, setSaveAddress] = useState(true);
  const [day, setDay] = useState(earliestDate(st.leadDays));
  const [hour, setHour] = useState('14:00');
  const methods = allowedPayments(type);
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<Order | null>(null);

  const lines = useCartLines();
  const subtotal = lines.reduce((a, l) => a + l.qty * l.unit, 0);
  const zone = type === 'entrega' ? zones.find((z) => z.city === address.city) : undefined;
  const fee = type === 'entrega' ? (zone?.fee ?? 0) : 0;
  const total = subtotal + fee;
  const minDay = earliestDate(st.leadDays);

  if (!account || !customer)
    return (
      <Section className="py-24 text-center">
        <h1 className="text-2xl font-bold">Entre para finalizar seu pedido</h1>
        <p className="mt-2 text-muted">Precisamos do seu cadastro para confirmar o pedido pelo WhatsApp.</p>
        <Button variant="primary" className="mt-6" onClick={() => requireLogin()}>
          Entrar ou criar conta
        </Button>
      </Section>
    );

  if (done) return <Success order={done} />;

  if (!lines.length)
    return (
      <Section className="py-24 text-center">
        <h1 className="text-2xl font-bold">Seu carrinho está vazio</h1>
        <Link to="/loja#cardapio" className="mt-4 inline-block font-semibold text-pink hover:underline">
          Ver cardápio
        </Link>
      </Section>
    );

  const place = () => {
    setError('');
    if (type === 'entrega') {
      if (!zone) return setError('Escolha uma cidade atendida para a entrega.');
      if (addressMissing(address)) return setError('Complete o endereço: bairro, rua e número.');
    }
    if (!methods.some((m) => m.method === method)) return setError('Escolha uma forma de pagamento válida para este tipo de recebimento.');
    if (!day || day < minDay) return setError(`Escolha uma data a partir de ${minDay.split('-').reverse().join('/')}.`);

    const chosen = methods.find((m) => m.method === method)!;
    const order = saveOrder({
      id: uid(),
      number: 0,
      customerId: customer.id,
      customerName: customer.name,
      items: lines.map((l) => ({
        id: uid(),
        recipeId: l.recipeId,
        name: l.label ? `${l.p.name} (${l.label})` : l.p.name,
        qty: l.qty,
        unitPrice: l.unit,
        // birthday cakes: cost comes from the quote of the chosen parts
        unitCost: l.cost ?? null,
        components: l.components,
      })),
      deliveryAt: fromLocalDateTime(`${day}T${hour}`),
      status: 'orcamento',
      discount: 0,
      deliveryFee: fee,
      notes: [notes.trim(), `Pagamento escolhido: ${chosen.label}${type === 'entrega' ? ' (antes da produção)' : ''}`].filter(Boolean).join('\n'),
      costFrozenAt: null,
      origin: 'loja',
      fulfillment: type === 'entrega' ? { type, address, fee } : { type, fee: 0 },
      payment: { method, note: chosen.note },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    if (type === 'entrega' && saveAddress) saveCustomer({ ...customer, address });
    clearCart();
    setDone(order);
    toast(`Pedido #${order.number} enviado!`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Section className="py-10">
      <button onClick={() => navigate('/loja')} className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Continuar comprando
      </button>
      <h1 className="text-3xl font-bold tracking-tight">Finalizar pedido</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Block n={1} title="Como você quer receber?">
            <Segmented
              value={type}
              onChange={(t) => {
                setType(t);
                if (!allowedPayments(t).some((m) => m.method === method)) setMethod('pix');
              }}
              options={[
                ...(zones.length ? [{ value: 'entrega' as const, label: 'Entrega' }] : []),
                { value: 'retirada' as const, label: 'Retirar no local' },
              ]}
            />
            <AnimatePresence mode="wait" initial={false}>
              {type === 'entrega' ? (
                <motion.div key="e" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 space-y-4">
                  <AddressFields value={address} onChange={setAddress} cities={zones.map((z) => z.city)} />
                  {zone && (
                    <p className="flex items-center gap-2 text-sm">
                      <Truck size={15} className="text-pink" /> Frete para {zone.city}: <b>{zone.fee === 0 ? 'grátis' : money(zone.fee)}</b>
                    </p>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="h-4 w-4 accent-pink-600" />
                    Salvar este endereço no meu cadastro
                  </label>
                  <p className="text-xs text-muted">Entregamos somente em Navegantes e cidades vizinhas listadas acima.</p>
                </motion.div>
              ) : (
                <motion.div key="r" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 flex items-start gap-3 rounded-2xl bg-subtle p-4 text-sm">
                  <Store size={18} className="mt-0.5 shrink-0 text-lilac" />
                  <span>{st.pickupAddress ? <>Retire em <b>{st.pickupAddress}</b>.</> : 'O endereço de retirada será confirmado pelo WhatsApp.'} Sem custo de frete.</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Block>

          <Block n={2} title="Para quando?">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Data" hint={`A partir de ${minDay.split('-').reverse().join('/')} (${st.leadDays} dia${st.leadDays === 1 ? '' : 's'} de antecedência).`}>
                <TextInput type="date" min={minDay} value={day} onChange={(e) => setDay(e.target.value)} />
              </Field>
              <Field label="Horário">
                <Select value={hour} onChange={(e) => setHour(e.target.value)}>
                  {HOURS.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Block>

          <Block n={3} title="Pagamento">
            <div role="radiogroup" aria-label="Forma de pagamento" className="grid gap-3 sm:grid-cols-3">
              {methods.map((m) => {
                const Icon = METHOD_ICON[m.method] ?? Wallet;
                const active = m.method === method;
                return (
                  <button
                    key={m.method}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMethod(m.method)}
                    className={cx('relative rounded-2xl border-2 p-4 text-left transition-colors', active ? 'border-pink bg-pink-soft/40' : 'border-line hover:border-pink/40')}
                  >
                    <Icon size={20} className={active ? 'text-pink' : 'text-muted'} />
                    <div className="mt-2 font-semibold">{m.label}</div>
                    <div className="mt-1 text-xs text-muted">{m.note}</div>
                    {active && (
                      <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-pink text-white">
                        <Check size={12} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {type === 'entrega' && <p className="mt-3 text-xs text-muted">Nas entregas aceitamos apenas Pix ou cartão de crédito, pagos antes da produção. Dinheiro na entrega só combinando antes pelo WhatsApp.</p>}
          </Block>

          <Block n={4} title="Observações (opcional)">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tema, recado no topo, sabor, alergias…"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-pink/60 focus:outline-none focus:ring-2 focus:ring-pink/20"
            />
          </Block>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-line bg-surface shadow-card">
            <div className="border-b border-divider px-5 py-4 font-semibold">Resumo</div>
            <ul className="divide-y divide-divider">
              {lines.map((l) => (
                <li key={l.key} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.p.name}</div>
                    {l.label && <div className="text-xs text-ink/80">{l.label}</div>}
                    <div className="text-xs text-muted">{money(l.unit * l.qty)}</div>
                  </div>
                  <QtyStepper value={l.qty} onChange={(q) => setQty(l.key, q)} />
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-divider px-5 py-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular">{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Frete</dt>
                <dd className="tabular">{type === 'retirada' ? 'retirada' : zone ? (fee === 0 ? 'grátis' : money(fee)) : 'escolha a cidade'}</dd>
              </div>
              <div className="flex justify-between border-t border-divider pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd className="tabular">{money(total)}</dd>
              </div>
            </dl>
            <div className="px-5 pb-5">
              {error && (
                <p role="alert" className="mb-3 rounded-lg bg-loss-soft px-3 py-2 text-sm text-loss">
                  {error}
                </p>
              )}
              <Button variant="primary" className="h-12 w-full text-base" onClick={place}>
                Enviar pedido
              </Button>
              <p className="mt-2 text-center text-xs text-muted">A confeitaria confirma o pedido e o pagamento antes de começar a produção.</p>
            </div>
          </div>
        </aside>
      </div>
    </Section>
  );
}

function Block({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-6 shadow-card">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-pink to-lilac text-sm text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Success({ order }: { order: Order }) {
  const { db } = useStore();
  const toast = useToast();
  const st = storeSettings(db.settings);
  const wa = normalizePhone(st.whatsapp);
  const total = order.items.reduce((a, i) => a + i.qty * i.unitPrice, 0) + order.deliveryFee;
  const method = order.payment?.method;
  const msg = `Olá! Acabei de fazer o pedido #${order.number} pela loja (${money(total)}).${method === 'pix' ? ' Segue o comprovante do Pix.' : method === 'credito' ? ' Pode me enviar o link de pagamento do cartão?' : ''}`;

  return (
    <Section className="py-14">
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }} className="mx-auto max-w-xl rounded-3xl border border-line bg-surface p-8 text-center shadow-pop">
        <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.15 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-profit-soft text-profit">
          <Check size={32} />
        </motion.span>
        <h1 className="mt-5 text-3xl font-bold">Pedido #{order.number} enviado!</h1>
        <p className="mt-2 text-muted">
          {order.fulfillment?.type === 'entrega' && order.fulfillment.address ? `Entrega em ${addressLine(order.fulfillment.address)}` : 'Retirada no local'} · total <b className="text-ink">{money(total)}</b>
        </p>

        <div className="mt-6 rounded-2xl bg-subtle p-5 text-left text-sm">
          <div className="font-semibold">Próximo passo</div>
          {method === 'pix' &&
            (db.settings.pixKey ? (
              <>
                <p className="mt-1 text-muted">Faça o Pix de {money(total)} para a chave abaixo e envie o comprovante pelo WhatsApp. A produção começa após a confirmação.</p>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
                  <QrCode size={16} className="text-pink" />
                  <code className="flex-1 truncate text-sm">{db.settings.pixKey}</code>
                  <button
                    className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink"
                    aria-label="Copiar chave Pix"
                    onClick={() => {
                      void navigator.clipboard?.writeText(db.settings.pixKey).then(() => toast('Chave Pix copiada'));
                    }}
                  >
                    <Copy size={15} />
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-1 text-muted">A confeitaria vai te enviar os dados do Pix pelo WhatsApp. A produção começa após o pagamento.</p>
            ))}
          {method === 'credito' && <p className="mt-1 text-muted">Você vai receber o link de pagamento do Mercado Pago pelo WhatsApp. A produção começa após o pagamento.</p>}
          {method === 'dinheiro' && <p className="mt-1 text-muted">Pague em dinheiro quando vier retirar. Vamos confirmar o pedido pelo WhatsApp.</p>}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {wa && (
            <a href={waLink(wa, msg)} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-profit px-5 font-semibold text-white hover:bg-profit/90">
              <MessageCircle size={18} /> Enviar pelo WhatsApp
            </a>
          )}
          <Link to="/loja/conta" className="inline-flex h-11 items-center rounded-xl border border-line px-5 font-semibold hover:bg-subtle">
            Ver meus pedidos
          </Link>
        </div>
      </motion.div>
    </Section>
  );
}
