import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useStore } from '../store/store';
import { money, relativeDay } from '../lib/format';
import { orderTotals } from '../lib/orders';
import { activeZones, addressLine, addressMissing, emptyAddress, storeSettings } from '../lib/shop';
import { normalizePhone } from '../lib/whatsapp';
import type { Address, OrderStatus } from '../lib/types';
import { Badge, Button, Field, TextInput } from '../components/ui';
import { useToast } from '../components/motion';
import { AddressFields } from './AuthDialog';
import { Section, useShop } from './ShopApp';

const CUSTOMER_STATUS: Record<OrderStatus, { label: string; tone: 'gray' | 'lilac' | 'pink' | 'amber' | 'green' | 'red' }> = {
  orcamento: { label: 'Aguardando confirmação', tone: 'amber' },
  confirmado: { label: 'Confirmado', tone: 'lilac' },
  em_producao: { label: 'Em produção', tone: 'pink' },
  pronto: { label: 'Pronto', tone: 'green' },
  entregue: { label: 'Entregue', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'red' },
};

export default function AccountPage() {
  const { db, ctx, saveCustomer } = useStore();
  const { customer, account, requireLogin } = useShop();
  const toast = useToast();
  const cities = activeZones(storeSettings(db.settings)).map((z) => z.city);
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState<Address>(customer?.address ?? emptyAddress());

  if (!account || !customer)
    return (
      <Section className="py-24 text-center">
        <h1 className="text-2xl font-bold">Entre na sua conta</h1>
        <Button variant="primary" className="mt-6" onClick={() => requireLogin()}>
          Entrar ou criar conta
        </Button>
      </Section>
    );

  const orders = db.orders.filter((o) => o.customerId === customer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const save = () => {
    if (name.trim().split(/\s+/).length < 2) return toast('Informe nome e sobrenome', 'error');
    if (!normalizePhone(phone)) return toast('WhatsApp inválido', 'error');
    const hasAddress = !addressMissing(address);
    saveCustomer({ ...customer, name: name.trim(), phone: phone.trim(), address: hasAddress ? address : customer.address });
    toast('Dados atualizados');
  };

  return (
    <Section className="py-10">
      <h1 className="text-3xl font-bold tracking-tight">Olá, {customer.name.split(' ')[0]}!</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="rounded-3xl border border-line bg-surface p-6 shadow-card">
          <h2 className="mb-4 text-lg font-semibold">Meus dados</h2>
          <div className="space-y-4">
            <Field label="Nome completo">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="WhatsApp">
                <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
              </Field>
              <Field label="E-mail">
                <TextInput value={customer.email ?? account.email} disabled />
              </Field>
            </div>
            <div>
              <div className="mb-2 text-[13px] font-medium">Endereço para entrega</div>
              {cities.length ? <AddressFields value={address} onChange={setAddress} cities={cities} /> : <p className="text-sm text-muted">No momento só trabalhamos com retirada.</p>}
            </div>
            <Button variant="primary" onClick={save}>
              Salvar dados
            </Button>
          </div>
        </section>

        <section className="rounded-3xl border border-line bg-surface shadow-card">
          <h2 className="border-b border-divider px-6 py-4 text-lg font-semibold">Meus pedidos</h2>
          {orders.length === 0 ? (
            <div className="p-10 text-center text-muted">
              <Package size={32} className="mx-auto mb-3 text-pink" />
              Você ainda não fez pedidos.{' '}
              <Link to="/loja#cardapio" className="font-semibold text-pink hover:underline">
                Ver cardápio
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-divider">
              {orders.map((o) => {
                const t = orderTotals(o, db.transactions, db.recipes, ctx);
                const s = CUSTOMER_STATUS[o.status];
                return (
                  <li key={o.id} className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <b>Pedido #{o.number}</b>
                      <Badge tone={s.tone}>{s.label}</Badge>
                      {o.status !== 'cancelado' && <Badge tone={t.payment === 'pago' ? 'green' : 'gray'}>{t.payment === 'pago' ? 'Pago' : t.payment === 'parcial' ? 'Pago em parte' : 'Pagamento pendente'}</Badge>}
                      <span className="ml-auto font-semibold tabular">{money(t.total)}</span>
                    </div>
                    <div className="mt-1 text-sm text-muted">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
                    <div className="mt-1 text-xs text-muted">
                      {o.fulfillment?.type === 'entrega' && o.fulfillment.address ? `Entrega · ${addressLine(o.fulfillment.address)}` : 'Retirada'} · {relativeDay(o.deliveryAt)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Section>
  );
}
