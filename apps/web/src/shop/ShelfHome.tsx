import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Heart, MessageCircle, Plus, Search, ShoppingBag } from 'lucide-react';
import { useStore } from '../store/store';
import { money } from '@cakeboss/domain/format';
import { hasOptions, startingPrice, storeSettings } from '@cakeboss/domain/shop';
import { promoPrice, promotionLabel } from '@cakeboss/domain/promotions';
import { cakeStartingPrice } from '@cakeboss/domain/cake';
import { normalizePhone } from '@cakeboss/domain/whatsapp';
import type { CakeProduct, Recipe } from '@cakeboss/domain/types';
import { useToast } from '../components/motion';
import { useShop } from './ShopApp';
import { cleanName } from './art';
import '@fontsource/dancing-script/700.css';
import './poster.css';

/** Chocolate drip along a band's edge (repeats across any width). */
export function Drip({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true">
      <path
        fill="currentColor"
        d="M0 0h1200v8c-30 0-34 22-58 22s-26-18-50-18-22 30-48 30-26-26-52-26-30 14-56 14-28-24-54-24-26 28-52 28-30-20-58-20-28 16-54 16-26-26-52-26-28 22-56 22-26-14-50-14-30 26-58 26-24-22-50-22-28 18-54 18-26-24-52-24-30 28-58 28-26-20-52-20-28 14-54 14-26-22-50-22-30 18-56 18-26-12-52-12-24 20-50 20-28-18-56-18S28 30 0 30z"
      />
    </svg>
  );
}

/** The bakery's seal: its logo, or its name set like a sticker, inside a scalloped badge. */
export function Seal({ size, logo, name }: { size: number; logo?: string; name: string }) {
  const n = 22;
  const r = 50;
  const bump = 4.2;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = 50 + Math.cos(a) * (r - bump);
    const y = 50 + Math.sin(a) * (r - bump);
    if (i === 0) d += `M${x} ${y}`;
    else {
      const m = ((i - 0.5) / n) * Math.PI * 2;
      d += ` Q${50 + Math.cos(m) * (r + bump * 0.6)} ${50 + Math.sin(m) * (r + bump * 0.6)} ${x} ${y}`;
    }
  }
  const words = name.trim().split(/\s+/);
  return (
    <span className="seal" style={{ width: size, height: size }}>
      <svg viewBox="-2 -2 104 104" aria-hidden="true">
        <path d={d + 'Z'} fill="#fdf3ea" />
        <circle cx="50" cy="50" r={r - bump - 5} fill="none" stroke="rgb(var(--pink))" strokeWidth="1.2" strokeDasharray="2 2.6" />
      </svg>
      <span className="seal__inner">
        {logo ? (
          <img src={logo} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="shop-script leading-[0.95] text-pink" style={{ fontSize: size * 0.17 }}>
            {words.slice(0, 2).join(' ')}
            {words.length > 2 && <br />}
            {words.slice(2).join(' ')}
            <Heart size={size * 0.1} className="mx-auto mt-1 fill-current" aria-hidden="true" />
          </span>
        )}
      </span>
    </span>
  );
}

type Item = { kind: 'product'; r: Recipe } | { kind: 'cake'; c: CakeProduct };

function MenuCard({ item }: { item: Item }) {
  const { db, ctx } = useStore();
  const { add, openProduct, openCake, promotions } = useShop();
  const toast = useToast();

  if (item.kind === 'cake') {
    const c = item.c;
    const from = cakeStartingPrice(c, db.recipes, ctx, db.settings);
    return (
      <article className="menu-card">
        <button type="button" onClick={() => openCake(c.id)} className="menu-card__photo" aria-label={`Montar ${c.name}`}>
          {c.image ? <img src={c.image} alt={c.name} loading="lazy" /> : <span className="grid h-full place-items-center px-4 font-display text-2xl font-bold">{c.name}</span>}
        </button>
        <h3 className="mt-3 font-display text-xl font-bold leading-tight">{c.name}</h3>
        <p className="mt-1 text-sm text-muted">Você escolhe tamanho, massa e recheios</p>
        <div className="mt-auto pt-4">
          <button type="button" onClick={() => openCake(c.id)} className="price-pill">
            {from !== null ? `a partir de ${money(from)}` : 'Montar'}
          </button>
        </div>
      </article>
    );
  }

  const r = item.r;
  const options = hasOptions(r);
  const base = options ? startingPrice(r) : (r.salePrice ?? 0);
  const { price, promo } = promoPrice(r.id, base, promotions);
  const name = cleanName(r.name);
  return (
    <article className="menu-card">
      <button type="button" onClick={() => openProduct(r.id)} className="menu-card__photo" aria-label={`Ver ${name}`}>
        {r.storeImage ? <img src={r.storeImage} alt={name} loading="lazy" /> : <span className="grid h-full place-items-center px-4 font-display text-2xl font-bold">{name}</span>}
        {promo && <span className="absolute left-2 top-2 rounded-full bg-pink px-2.5 py-1 text-xs font-bold text-white">{promotionLabel(promo)}</span>}
      </button>
      <h3 className="mt-3 font-display text-xl font-bold leading-tight">{name}</h3>
      {r.storeDescription && <p className="mt-1 line-clamp-2 text-sm text-muted">{r.storeDescription}</p>}
      <div className="mt-auto flex items-center justify-center gap-3 pt-4">
        <span className="price-pill">
          {options && <small className="font-medium">a partir de</small>}
          {promo && <s className="font-medium opacity-80">{money(base)}</s>}
          {money(price)}
        </span>
        <button
          type="button"
          onClick={() => {
            if (options) return openProduct(r.id);
            add(r.id);
            toast(`${name} no carrinho`);
          }}
          aria-label={options ? `Escolher opções de ${name}` : `Adicionar ${name} ao carrinho`}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white transition-transform duration-150 ease-out active:scale-95"
        >
          <Plus size={18} />
        </button>
      </div>
    </article>
  );
}

function Shelf({ id, title, items }: { id: string; title: string; items: Item[] }) {
  const reduce = useReducedMotion();
  if (!items.length) return null;
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-24">
      <h2 id={`${id}-t`} className="mb-6 text-center">
        <span className="ribbon shop-script text-3xl sm:text-4xl">{title}</span>
      </h2>
      <motion.div
        className="shelf-row"
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        {items.map((it) => (
          <MenuCard key={it.kind === 'cake' ? `c-${it.c.id}` : it.r.id} item={it} />
        ))}
      </motion.div>
      <div className="shelf-plank" aria-hidden="true" />
    </section>
  );
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Top of the store: the bakery's poster, then its menu as shelves (promotions first). */
export default function ShelfHome() {
  const { db } = useStore();
  const { products, cakes, promotions } = useShop();
  const st = storeSettings(db.settings);
  const name = st.storeName?.trim() || db.settings.businessName || 'Confeitaria';
  const wa = normalizePhone(st.whatsapp);
  const [q, setQ] = useState('');

  const shelves = useMemo(() => {
    const match = (text: string) => !q.trim() || norm(text).includes(norm(q.trim()));
    const visible = products.filter((r) => match(`${r.name} ${r.category} ${r.storeDescription ?? ''}`));
    const onSale = visible.filter((r) => promoPrice(r.id, r.salePrice ?? 0, promotions).promo);
    const byCat = new Map<string, Recipe[]>();
    for (const r of visible) {
      const k = r.category?.trim() || 'Doces';
      byCat.set(k, [...(byCat.get(k) ?? []), r]);
    }
    const list: { id: string; title: string; items: Item[] }[] = [];
    if (onSale.length) list.push({ id: 'promocoes', title: 'Promoções', items: onSale.map((r) => ({ kind: 'product', r })) });
    const cakeItems = cakes.filter((c) => match(c.name)).map((c) => ({ kind: 'cake' as const, c }));
    if (cakeItems.length) list.push({ id: 'monte-seu-bolo', title: 'Monte seu bolo', items: cakeItems });
    for (const [cat, rs] of byCat) list.push({ id: `cat-${norm(cat).replace(/[^a-z0-9]+/g, '-')}`, title: cat, items: rs.map((r) => ({ kind: 'product', r })) });
    return list;
  }, [products, cakes, promotions, q]);

  return (
    <>
      <div className="choc-band pb-24 pt-10 text-center">
        <Drip className="drip-bottom" />
      </div>
      <header className="relative -mt-24 px-4 text-center">
        <div className="mx-auto w-fit">
          <Seal size={164} logo={st.logo} name={name} />
        </div>
        <h1 className="mt-4 flex items-center justify-center gap-3 text-[clamp(44px,8vw,96px)] leading-[1.02] text-[rgb(74_38_24)]">
          <Heart size={28} className="hidden shrink-0 text-pink sm:block" aria-hidden="true" />
          <span className="shop-script">{name}</span>
          <Heart size={28} className="hidden shrink-0 text-pink sm:block" aria-hidden="true" />
        </h1>
        <p className="mt-3">
          <span className="ribbon shop-script text-2xl sm:text-3xl">Cardápio</span>
        </p>
        <p className="mx-auto mt-5 max-w-xl text-lg">{st.about || `Doces sob encomenda da ${name}. Receba em casa ou retire com a gente.`}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="#cardapio" className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[rgb(74_38_24)] px-6 font-semibold text-[#fbefe4] transition-transform duration-150 ease-out active:scale-[0.97]">
            <ShoppingBag size={18} /> Ver cardápio
          </a>
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[48px] items-center gap-2 rounded-full border-2 border-pink px-6 font-semibold text-pink transition-transform duration-150 ease-out active:scale-[0.97]">
              <MessageCircle size={18} /> WhatsApp
            </a>
          )}
        </div>
      </header>

      <div id="cardapio" className="mx-auto mt-14 max-w-6xl scroll-mt-20 px-4">
        <label className="mx-auto flex h-12 max-w-md items-center gap-3 rounded-full border-2 border-pink/30 bg-[#fffaf6] px-5 focus-within:border-pink">
          <Search size={18} className="text-pink" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar no cardápio" aria-label="Procurar no cardápio" className="w-full bg-transparent text-base outline-none" />
        </label>
        {shelves.length > 1 && (
          <nav aria-label="Categorias" className="mt-5 flex flex-wrap justify-center gap-2">
            {shelves.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="rounded-full bg-pink-soft px-4 py-2 text-sm font-semibold text-pink transition-colors hover:bg-pink hover:text-white">
                {s.title}
              </a>
            ))}
          </nav>
        )}
        <div className="mt-12 space-y-16">
          {shelves.length ? (
            shelves.map((s) => <Shelf key={s.id} {...s} />)
          ) : (
            <p className="rounded-3xl bg-[#fffaf6] p-10 text-center text-lg">{q ? `Nada encontrado para “${q}”.` : 'O cardápio está sendo preparado. Volte em breve!'}</p>
          )}
        </div>
      </div>
    </>
  );
}

/** Closing band of the store with the bakery's line. */
export function ChocolateFooterBand() {
  const { db } = useStore();
  const st = storeSettings(db.settings);
  return (
    <div className="choc-band mt-32 px-4 pb-14 pt-16 text-center">
      <Drip className="drip-top" />
      <p className="shop-script text-[clamp(28px,4vw,44px)] leading-tight">{st.tagline?.trim() || 'Delícias artesanais, feitas com carinho!'}</p>
    </div>
  );
}
