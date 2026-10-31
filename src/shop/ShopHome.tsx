import { useRef, type PointerEvent } from 'react';
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { Check, CreditCard, MapPin, MessageCircle, Plus, QrCode, ShoppingBag, Store, Truck } from 'lucide-react';
import { useStore } from '../store/store';
import { money } from '../lib/format';
import { activeZones, hasOptions, startingPrice, storeSettings } from '../lib/shop';
import { normalizePhone } from '../lib/whatsapp';
import type { CakeProduct, Recipe } from '../lib/types';
import { cakeStartingPrice } from '../lib/cake';
import { Button } from '../components/ui';
import { useToast } from '../components/motion';
import { Section, useShop } from './ShopApp';
import { cleanName } from './art';
import CakeStory, { AboutBakery, CakeTurntable } from './CakeStory';

/** Birthday cake the customer builds: opens the cake builder. */
function CakeCard({ cake, index }: { cake: CakeProduct; index: number }) {
  const { db, ctx } = useStore();
  const { openCake } = useShop();
  const reduce = useReducedMotion();
  const from = cakeStartingPrice(cake, db.recipes, ctx, db.settings);
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 50, rotateX: 25 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ type: 'spring', stiffness: 120, damping: 18, delay: (index % 3) * 0.08 }}
      style={{ perspective: 900 }}
    >
      <div className="group relative overflow-hidden rounded-3xl bg-surface">
        <button
          type="button"
          onClick={() => openCake(cake.id)}
          aria-label={`Montar ${cake.name}`}
          className="relative grid h-52 w-full place-items-center overflow-hidden bg-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink/30"
        >
          {cake.image ? (
            <img src={cake.image} alt={cake.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <span className="px-6 text-center font-display text-3xl font-extrabold leading-tight tracking-[-0.02em]">{cake.name}</span>
          )}
          <span className="absolute left-4 top-4 rounded-full bg-pink px-3 py-1 text-[13px] font-semibold text-white">Monte do seu jeito</span>
        </button>
        <div className="p-5">
          <button type="button" onClick={() => openCake(cake.id)} className="text-left text-lg font-semibold leading-tight hover:text-pink">
            {cake.name}
          </button>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{cake.description || `${cake.sizes.length} tamanhos · ${cake.massas.length} massas · até ${cake.maxRecheios} recheios`}</p>
          <div className="mt-4 flex items-end justify-between gap-2">
            <div>
              <div className="text-[11px] text-muted">a partir de</div>
              <div className="text-2xl font-bold tabular">{from !== null ? money(from) : '—'}</div>
            </div>
            <Button variant="primary" onClick={() => openCake(cake.id)}>
              <Plus size={16} /> Montar bolo
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** Card that tilts in 3D following the pointer, with layers at different depths. */
function ProductCard({ r, index }: { r: Recipe; index: number }) {
  const { add, openCart, openProduct } = useShop();
  const toast = useToast();
  const reduce = useReducedMotion();
  const withOptions = hasOptions(r);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const sx = useSpring(rx, { stiffness: 220, damping: 18 });
  const sy = useSpring(ry, { stiffness: 220, damping: 18 });
  // the photo slides slightly against the tilt, so it looks like it has depth
  const imgX = useTransform(sy, (v) => v * -0.8);
  const imgY = useTransform(sx, (v) => v * 0.8);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType === 'touch') return;
    const b = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - b.left) / b.width - 0.5) * 18);
    rx.set(-((e.clientY - b.top) / b.height - 0.5) * 18);
  };
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 50, rotateX: 25 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ type: 'spring', stiffness: 120, damping: 18, delay: (index % 3) * 0.08 }}
      style={{ perspective: 900 }}
    >
      <motion.div
        onPointerMove={move}
        onPointerLeave={() => {
          rx.set(0);
          ry.set(0);
        }}
        style={{ rotateX: sx, rotateY: sy, transformStyle: 'preserve-3d' }}
        className="group relative overflow-hidden rounded-3xl bg-surface"
      >
        <button
          type="button"
          onClick={() => openProduct(r.id)}
          aria-label={`Ver ${cleanName(r.name)}`}
          className="relative grid h-52 w-full cursor-zoom-in place-items-center overflow-hidden bg-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink/30"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {r.storeImage ? (
            <motion.img
              src={r.storeImage}
              alt={r.name}
              loading="lazy"
              className="h-full w-full object-cover"
              style={{ scale: 1.08, x: imgX, y: imgY }}
            />
          ) : (
            <span className="px-6 text-center font-display text-3xl font-extrabold leading-tight tracking-[-0.02em]" style={{ transform: 'translateZ(40px)' }}>
              {cleanName(r.name)}
            </span>
          )}
          {r.category && <span className="absolute left-4 top-4 rounded-full bg-surface px-3 py-1 text-[13px] font-semibold text-ink">{r.category}</span>}
          <span className="absolute bottom-3 right-3 rounded-full bg-surface px-3 py-1 text-[13px] font-semibold text-ink opacity-0 transition-opacity group-hover:opacity-100">Ver produto</span>
        </button>
        <div className="p-5" style={{ transform: 'translateZ(30px)' }}>
          <button type="button" onClick={() => openProduct(r.id)} className="text-left text-lg font-semibold leading-tight hover:text-pink">
            {cleanName(r.name)}
          </button>
          {r.storeDescription && <p className="mt-1 line-clamp-2 text-sm text-muted">{r.storeDescription}</p>}
          <div className="mt-4 flex items-end justify-between gap-2">
            <div>
              {withOptions && <div className="text-[11px] text-muted">a partir de</div>}
              <div className="text-2xl font-bold tabular">{money(withOptions ? startingPrice(r) : (r.salePrice ?? 0))}</div>
              <div className="text-xs text-muted">{withOptions ? `escolha ${(r.storeOptions ?? []).filter((g) => g.choices.length).map((g) => g.name.toLowerCase()).join(', ')}` : `por ${r.unitLabel}`}</div>
            </div>
            <Button
              variant="primary"
              onClick={() => {
                if (withOptions) return openProduct(r.id);
                add(r.id);
                toast(`${cleanName(r.name)} no carrinho`);
              }}
              aria-label={withOptions ? `Escolher opções de ${cleanName(r.name)}` : `Adicionar ${r.name} ao carrinho`}
            >
              <Plus size={16} /> {withOptions ? 'Escolher' : 'Adicionar'}
            </Button>
          </div>
          <button type="button" onClick={openCart} className="mt-2 text-xs font-medium text-pink opacity-0 transition-opacity group-hover:opacity-100">
            Ver carrinho →
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ShopHome() {
  const { db } = useStore();
  const { products, cakes } = useShop();
  const reduce = useReducedMotion();
  const st = storeSettings(db.settings);
  const zones = activeZones(st);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const wa = normalizePhone(st.whatsapp);
  const name = db.settings.businessName || 'nossa confeitaria';

  return (
    <>
      {/* hero: the cake turning on its stand, on the same charcoal as the clip's backdrop */}
      <div ref={heroRef} className="relative overflow-hidden bg-[#535757] text-[#F6F1EA]">
        <div className="relative mx-auto grid max-w-6xl items-center gap-4 px-4 pb-16 pt-2 lg:min-h-[min(84svh,780px)] lg:grid-cols-[1.15fr_1fr] lg:gap-10 lg:py-8">
          <motion.div style={reduce ? undefined : { y: textY, opacity: textOpacity }}>
            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="font-display text-[2.35rem] font-extrabold leading-[0.98] tracking-[-0.03em] [text-wrap:balance] sm:text-6xl lg:text-[4.25rem]"
            >
              Doces feitos à mão em Navegantes
            </motion.h1>
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
              className="mt-5 max-w-md text-lg sm:text-xl"
            >
              {st.about || `Bolos, brownies e doces da ${name}, sob encomenda. Receba em casa ou retire com a gente.`}
            </motion.p>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: [0.23, 1, 0.32, 1] }}
              className="mt-7 flex flex-wrap gap-3 sm:mt-9"
            >
              <a href="#cardapio" className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-[#F6F1EA] px-7 text-base font-semibold text-[#2a1810] transition-[transform,background-color] duration-150 ease-out hover:bg-white active:scale-[0.97]">
                <ShoppingBag size={18} /> Ver cardápio
              </a>
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-white/10 px-6 text-base font-semibold transition-[transform,background-color] duration-150 ease-out hover:bg-white/20 active:scale-[0.97]">
                  <MessageCircle size={18} /> Falar no WhatsApp
                </a>
              )}
            </motion.div>
          </motion.div>
          <div className="relative order-first h-[42svh] min-h-[300px] sm:h-[52svh] lg:order-none lg:h-[min(82svh,760px)]">
            <CakeTurntable />
          </div>
        </div>
      </div>

      {/* scroll story with the bakery's photos */}
      <CakeStory />

      <AboutBakery
        text="Chocolate derretido na hora e bolo montado só quando você encomenda."
        body="Nada fica pronto na vitrine esperando. Cada doce é feito para o seu dia, com o capricho de quem faz cada um como se fosse o primeiro."
      />

      {/* menu */}
      <Section id="cardapio" className="scroll-mt-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">Cardápio</h2>
            <p className="mt-2 text-lg">Feito sob encomenda, com antecedência mínima de {st.leadDays} dia{st.leadDays === 1 ? '' : 's'}.</p>
          </div>
        </div>
        {products.length === 0 && cakes.length === 0 ? (
          <div className="rounded-3xl bg-subtle p-12 text-center text-lg">O cardápio está sendo preparado. Volte em breve!</div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cakes.map((k, i) => (
              <CakeCard key={k.id} cake={k} index={i} />
            ))}
            {products.map((r, i) => (
              <ProductCard key={r.id} r={r} index={i} />
            ))}
          </div>
        )}
      </Section>

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
