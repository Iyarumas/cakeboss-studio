import { motion, useReducedMotion } from 'motion/react';
import { Check, CreditCard, MapPin, QrCode, Store, Truck } from 'lucide-react';
import { useStore } from '../store/store';
import { money } from '@cakeboss/domain/format';
import { activeZones, storeSettings } from '@cakeboss/domain/shop';
import { normalizePhone } from '@cakeboss/domain/whatsapp';
import { Section } from './ShopApp';
import CakeStory, { AboutBakery } from './CakeStory';
import ShelfHome from './ShelfHome';

export default function ShopHome() {
  const { db } = useStore();
  const reduce = useReducedMotion();
  const st = storeSettings(db.settings);
  const zones = activeZones(st);
  const wa = normalizePhone(st.whatsapp);

  return (
    <>
      {/* the bakery's poster and its menu as shelves */}
      <ShelfHome />

      {/* scroll story with the bakery's photos */}
      <CakeStory />

      <AboutBakery
        text="Chocolate derretido na hora e bolo montado só quando você encomenda."
        body="Nada fica pronto na vitrine esperando. Cada doce é feito para o seu dia, com o capricho de quem faz cada um como se fosse o primeiro."
      />

      {/* how it works: three steps set as a list in large type */}
      <Section className="mt-32">
        <h2 className="font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">Como funciona</h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
          {[
            { t: 'Escolha', d: 'Monte seu pedido pelo cardápio e escolha a data.' },
            { t: 'Pague com segurança', d: 'Pix ou cartão de crédito pelo Mercado Pago. Dinheiro só na retirada.' },
            { t: 'Receba ou retire', d: zones.length ? `Entregamos em ${zones.map((z) => z.city).join(', ')}.` : 'Retire com a gente no dia combinado.' },
          ].map((s, i) => (
            <motion.li
              key={s.t}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.07, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            >
              <h3 className="font-display text-2xl font-bold sm:text-3xl">{s.t}</h3>
              <p className="mt-2 max-w-xs text-lg">{s.d}</p>
            </motion.li>
          ))}
        </ol>
      </Section>

      {/* delivery + payment */}
      <Section id="entrega" className="mt-24">
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div initial={reduce ? false : { opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="rounded-3xl bg-surface p-7">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-pink-soft text-pink">
                <Truck size={20} />
              </span>
              <h2 className="font-display text-2xl font-bold">Onde entregamos</h2>
            </div>
            {zones.length === 0 ? (
              <p className="mt-4 text-muted">No momento trabalhamos só com retirada. {st.pickupAddress && `Endereço: ${st.pickupAddress}.`}</p>
            ) : (
              <ul className="mt-5 grid gap-1">
                {zones.map((z) => (
                  <li key={z.id} className="flex items-center justify-between py-3">
                    <span className="flex items-center gap-2 font-medium">
                      <MapPin size={15} className="text-pink" /> {z.city}
                    </span>
                    <span className="text-sm tabular text-muted">{z.fee === 0 ? 'frete grátis' : `frete ${money(z.fee)}`}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-subtle p-4 text-sm">
              <Store size={18} className="mt-0.5 shrink-0 text-lilac" />
              <span>
                <b>Retirada sem custo</b>
                {st.pickupAddress ? ` em ${st.pickupAddress}` : ''}. Vendemos apenas para Navegantes e região.
              </span>
            </div>
          </motion.div>

          <motion.div id="pagamento" initial={reduce ? false : { opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="scroll-mt-24 rounded-3xl bg-surface p-7">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-lilac-soft text-lilac">
                <CreditCard size={20} />
              </span>
              <h2 className="font-display text-2xl font-bold">Como pagar</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-subtle p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <Truck size={16} className="text-pink" /> Entrega
                </div>
                <ul className="mt-2 space-y-1.5 text-sm text-muted">
                  <li className="flex gap-2">
                    <QrCode size={15} className="mt-0.5 shrink-0" /> Pix
                  </li>
                  <li className="flex gap-2">
                    <CreditCard size={15} className="mt-0.5 shrink-0" /> Cartão de crédito
                  </li>
                </ul>
                <p className="mt-2 text-xs text-muted">Pagamento antes da produção, pelo Mercado Pago.</p>
              </div>
              <div className="rounded-2xl bg-subtle p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <Store size={16} className="text-lilac" /> Retirada
                </div>
                <ul className="mt-2 space-y-1.5 text-sm text-muted">
                  <li className="flex gap-2">
                    <Check size={15} className="mt-0.5 shrink-0" /> Pix ou cartão de crédito
                  </li>
                  <li className="flex gap-2">
                    <Check size={15} className="mt-0.5 shrink-0" /> Dinheiro na retirada
                  </li>
                </ul>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted">
              Quer pagar em dinheiro numa entrega?{' '}
              {wa ? (
                <a className="font-semibold text-profit hover:underline" href={`https://wa.me/${wa}?text=${encodeURIComponent('Olá! Gostaria de combinar um pedido com pagamento em dinheiro na entrega.')}`} target="_blank" rel="noreferrer">
                  Combine com a gente pelo WhatsApp
                </a>
              ) : (
                'Combine com a confeitaria pelo WhatsApp.'
              )}
            </p>
          </motion.div>
        </div>
      </Section>
    </>
  );
}
