import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Cake, LogOut, Minus, Plus, ShoppingBag, Trash, User, X } from 'lucide-react';
import { useStore } from '../store/store';
import { money } from '../lib/format';
import { cleanSelection, lineKey, selectionLabel, storeProducts, storeSettings, unitPriceFor, type CartLine, type Selection } from '../lib/shop';
import { currentAccount, signOut, type Account } from '../lib/shopAuth';
import type { Customer, Promotion, Recipe } from '../lib/types';
import { promoPrice } from '../lib/promotions';
import { Button, cx } from '../components/ui';
import { ToastProvider } from '../components/motion';
import { AccentStyle } from '../components/AccentPicker';
import { AuthDialog } from './AuthDialog';
import ShopHome from './ShopHome';
import { ChocolateFooterBand } from './ShelfHome';
import Checkout from './Checkout';
import AccountPage from './AccountPage';
import { ProductDialog } from './ProductDialog';
import { CakeDialog } from './CakeDialog';
import { cakeQuote, cakeReady } from '../lib/cake';
import type { CakeProduct, CakeSelection } from '../lib/types';

const CART_KEY = 'docegestao:loja:carrinho';

interface ShopCtx {
  products: Recipe[];
  cart: CartLine[];
  /** changes the quantity of a cart line (by its key); 0 removes it */
  setQty: (key: string, qty: number) => void;
  add: (recipeId: string, qty?: number, options?: Selection) => void;
  /** opens the product window (photo, description, sizes/flavors) */
  openProduct: (recipeId: string) => void;
  /** birthday cakes the customer builds */
  cakes: CakeProduct[];
  openCake: (cakeId: string) => void;
  addCake: (cakeId: string, sel: CakeSelection, qty?: number) => void;
  clearCart: () => void;
  account: Account | null;
  customer: Customer | null;
  refreshAuth: () => void;
  /** opens login/sign-up; `then` runs after a successful login */
  requireLogin: (then?: () => void) => void;
  openCart: () => void;
  /** the baker's discounts; prices shown and charged already include the running ones */
  promotions: Promotion[];
}

const Ctx = createContext<ShopCtx | null>(null);
export const useShop = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useShop fora da loja');
  return c;
};

/** Public online store (route /loja). Uses the same data as the admin. */
export default function ShopApp() {
  const { db } = useStore();
  const navigate = useNavigate();
  const st = storeSettings(db.settings);
  const products = useMemo(() => storeProducts(db.recipes), [db.recipes]);
  const cakes = useMemo(() => (st.cakes ?? []).filter(cakeReady), [st.cakes]);
  const [cakeId, setCakeId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>(() => {
    try {
      // carts saved before options existed have no key
      return (JSON.parse(localStorage.getItem(CART_KEY) ?? '[]') as CartLine[]).map((l) => ({ ...l, key: l.key ?? lineKey(l.recipeId, l.options) }));
    } catch {
      return [];
    }
  });
  const [account, setAccount] = useState<Account | null>(() => currentAccount());
  const [auth, setAuth] = useState<{ then?: () => void } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* cart only lives for this visit */
    }
  }, [cart]);

  // drop items that left the store (hidden product or price removed)
  useEffect(() => {
    setCart((c) => c.filter((l) => (l.cake ? cakes.some((k) => k.id === l.recipeId) : products.some((p) => p.id === l.recipeId))));
  }, [products, cakes]);

  useEffect(() => {
    document.title = `${db.settings.businessName || 'Confeitaria'} · Loja`;
    return () => {
      document.title = 'CakeBoss';
    };
  }, [db.settings.businessName]);

  const customer = account ? (db.customers.find((c) => c.id === account.customerId) ?? null) : null;

  const ctx: ShopCtx = {
    products,
    cart,
    setQty: (key, qty) => setCart((c) => (qty <= 0 ? c.filter((l) => l.key !== key) : c.map((l) => (l.key === key ? { ...l, qty } : l)))),
    add: (id, qty = 1, options = {}) =>
      setCart((c) => {
        const key = lineKey(id, options);
        return c.some((l) => l.key === key) ? c.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l)) : [...c, { key, recipeId: id, qty, options }];
      }),
    openProduct: setProductId,
    cakes,
    openCake: setCakeId,
    addCake: (id, sel, qty = 1) =>
      setCart((c) => {
        const key = `bolo:${id}|${sel.sizeId}|${sel.massaId}|${sel.recheioIds.join(',')}|${sel.coberturaId ?? ''}`;
        return c.some((l) => l.key === key) ? c.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l)) : [...c, { key, recipeId: id, qty, cake: sel }];
      }),
    clearCart: () => setCart([]),
    account,
    customer,
    refreshAuth: () => setAccount(currentAccount()),
    requireLogin: (then) => (account && customer ? then?.() : setAuth({ then })),
    openCart: () => setCartOpen(true),
    promotions: st.promotions ?? [],
  };
  const count = cart.reduce((a, l) => a + l.qty, 0);
  const logout = useCallback(() => {
    signOut();
    setAccount(null);
    navigate('/loja');
  }, [navigate]);

  return (
    <Ctx.Provider value={ctx}>
      <ToastProvider>
        <AccentStyle choice={db.settings.accentShop ?? db.settings.accentAdmin} />
        <div data-theme="light" data-surface="shop" style={shopTheme(!db.settings.accentShop)} className="min-h-screen overflow-x-clip bg-bg text-ink">
          <div className="bg-warn-soft px-4 py-2 text-center text-[13px] text-ink">
            <b>Modo demonstração:</b> cadastros e pedidos ficam salvos só neste navegador e ainda não chegam à confeitaria por outros aparelhos. Login com Google será ativado quando a loja estiver na nuvem.
          </div>
          <header className="sticky top-0 z-30 bg-surface">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
              <Link to="/loja" className="flex items-center gap-2.5">
                {st.logo ? (
                  <img src={st.logo} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-pink/30" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-pink text-white">
                    <Cake size={18} />
                  </span>
                )}
                <span className="shop-script text-2xl leading-none text-[rgb(74_38_24)]">{st.storeName?.trim() || db.settings.businessName || 'Confeitaria'}</span>
              </Link>
              <nav className="ml-6 hidden items-center gap-5 text-sm text-muted md:flex">
                <a href="/loja#cardapio" className="hover:text-ink">
                  Cardápio
                </a>
                <a href="/loja#entrega" className="hover:text-ink">
                  Entrega
                </a>
                <a href="/loja#pagamento" className="hover:text-ink">
                  Pagamento
                </a>
              </nav>
              <div className="ml-auto flex items-center gap-2">
                {account && customer ? (
                  <>
                    <Link to="/loja/conta" className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-subtle sm:flex">
                      <User size={16} /> {customer.name.split(' ')[0]}
                    </Link>
                    <button className="rounded-lg p-2 text-muted hover:bg-subtle hover:text-ink" onClick={logout} aria-label="Sair" title="Sair">
                      <LogOut size={16} />
                    </button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setAuth({})}>
                    <User size={15} /> Entrar
                  </Button>
                )}
                <button onClick={() => setCartOpen(true)} className="relative flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white hover:bg-ink/90" aria-label={`Carrinho com ${count} itens`}>
                  <ShoppingBag size={16} />
                  <span className="hidden sm:inline">Carrinho</span>
                  <AnimatePresence>
                    {count > 0 && (
                      <motion.span key={count} initial={{ scale: 0.4 }} animate={{ scale: 1 }} className="grid h-5 min-w-5 place-items-center rounded-full bg-pink px-1 text-[11px]">
                        {count}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </div>
          </header>

          {!st.enabled ? (
            <div className="mx-auto max-w-md px-4 py-24 text-center">
              <h1 className="text-2xl font-bold">Loja fechada no momento</h1>
              <p className="mt-2 text-muted">Volte em breve! 🧁</p>
            </div>
          ) : (
            <Routes>
              <Route index element={<ShopHome />} />
              <Route path="finalizar" element={<Checkout />} />
              <Route path="conta" element={<AccountPage />} />
            </Routes>
          )}

          <ChocolateFooterBand />
          <footer className="bg-surface">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between">
              <span>
                © {new Date().getFullYear()} {db.settings.businessName || 'Confeitaria'} · Navegantes e região
              </span>
              <Link to="/" className="hover:text-ink">
                Área da confeitaria
              </Link>
            </div>
          </footer>

          <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
          <ProductDialog recipe={products.find((p) => p.id === productId) ?? null} onClose={() => setProductId(null)} />
          <CakeDialog cake={cakes.find((k) => k.id === cakeId) ?? null} onClose={() => setCakeId(null)} />
          <AuthDialog
            open={!!auth}
            onClose={() => setAuth(null)}
            onDone={() => {
              const then = auth?.then;
              setAccount(currentAccount());
              setAuth(null);
              // wait for the account to be in state before continuing
              setTimeout(() => then?.(), 0);
            }}
          />
        </div>
      </ToastProvider>
    </Ctx.Provider>
  );
}

/** Cart lines with their product, the options still valid, the unit price and a readable label. */
export interface ShopLine {
  key: string;
  qty: number;
  /** what is shown: name, unit and photo */
  p: { id: string; name: string; unitLabel: string; storeImage?: string };
  unit: number;
  label: string;
  /** recipe to link the order item to (null for birthday cakes) */
  recipeId: string | null;
  /** birthday cakes: cost and fichas known from the quote */
  cost?: number;
  components?: { recipeId: string; batches: number }[];
}

export function useCartLines(): ShopLine[] {
  const { cart, products, cakes } = useShop();
  const { db, ctx } = useStore();
  return useMemo(
    () =>
      cart
        .map((l): ShopLine | null => {
          if (l.cake) {
            const k = cakes.find((x) => x.id === l.recipeId);
            if (!k) return null;
            const q = cakeQuote(k, l.cake, db.recipes, ctx, db.settings);
            if (q.problems.length) return null;
            return { key: l.key, qty: l.qty, p: { id: k.id, name: k.name, unitLabel: 'bolo', storeImage: k.image }, unit: q.price, label: q.label, recipeId: null, cost: q.cost, components: q.components };
          }
          const p = products.find((x) => x.id === l.recipeId);
          if (!p) return null;
          const options = cleanSelection(p, l.options);
          return { key: l.key, qty: l.qty, p, unit: promoPrice(p.id, unitPriceFor(p, options), storeSettings(db.settings).promotions).price, label: selectionLabel(p, options), recipeId: p.id };
        })
        .filter((l): l is ShopLine => !!l),
    [cart, products, cakes, db.recipes, ctx, db.settings],
  );
}

function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setQty, requireLogin } = useShop();
  const navigate = useNavigate();
  const lines = useCartLines();
  const subtotal = lines.reduce((a, l) => a + l.qty * l.unit, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-label="Carrinho"
            className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col bg-surface shadow-pop"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          >
            <div className="flex items-center justify-between border-b border-divider px-5 py-4">
              <h2 className="text-lg font-semibold">Seu carrinho</h2>
              <button className="rounded-md p-1 text-muted hover:bg-subtle" onClick={onClose} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted">
                <ShoppingBag size={36} className="mb-3 text-pink" />
                Seu carrinho está vazio.
                <Button className="mt-4" onClick={onClose}>
                  Ver cardápio
                </Button>
              </div>
            ) : (
              <>
                <ul className="flex-1 divide-y divide-divider overflow-y-auto">
                  {lines.map((l) => (
                    <li key={l.key} className="flex items-center gap-3 px-5 py-4">
                      {l.p.storeImage ? <img src={l.p.storeImage} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : null}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{l.p.name}</div>
                        {l.label && <div className="text-xs text-ink/80">{l.label}</div>}
                        <div className="text-xs text-muted">
                          {money(l.unit)} / {l.p.unitLabel}
                        </div>
                      </div>
                      <QtyStepper value={l.qty} onChange={(q) => setQty(l.key, q)} />
                      <button className="rounded p-1 text-muted hover:text-loss" onClick={() => setQty(l.key, 0)} aria-label={`Remover ${l.p.name}`}>
                        <Trash size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-divider p-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Subtotal</span>
                    <b className="tabular">{money(subtotal)}</b>
                  </div>
                  <p className="mt-1 text-xs text-muted">Frete calculado na próxima etapa, conforme sua cidade.</p>
                  <Button
                    variant="primary"
                    className="mt-4 h-12 w-full text-base"
                    onClick={() =>
                      requireLogin(() => {
                        onClose();
                        navigate('/loja/finalizar');
                      })
                    }
                  >
                    Finalizar pedido
                  </Button>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function QtyStepper({ value, onChange, min = 1 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="flex items-center rounded-lg border border-line">
      <button type="button" className="grid h-8 w-8 place-items-center text-muted hover:text-ink disabled:opacity-40" onClick={() => onChange(value - 1)} disabled={value <= (min > 1 ? min : 0)} aria-label="Diminuir">
        <Minus size={14} />
      </button>
      <span className={cx('w-8 text-center text-sm font-semibold tabular')}>{value}</span>
      <button type="button" className="grid h-8 w-8 place-items-center text-muted hover:text-ink" onClick={() => onChange(value + 1)} aria-label="Aumentar">
        <Plus size={14} />
      </button>
    </div>
  );
}

/**
 * Chocolate-and-cream palette of the store (warm bakery tones that match the cake photos).
 * The accent pair (raspberry + caramel) only applies while the bakery hasn't picked its own store color.
 */
function shopTheme(withAccent: boolean): CSSProperties {
  const t: Record<string, string> = {
    '--bg': '246 241 234',
    '--surface': '252 250 246',
    '--subtle': '238 231 222',
    '--border': '226 217 205',
    '--divider': '234 226 216',
    '--text': '59 35 20',
    '--muted': '124 90 68',
  };
  if (withAccent) Object.assign(t, { '--pink': '190 47 85', '--pink-ink': '163 36 70', '--pink-soft': '251 228 233', '--lilac': '180 83 9', '--lilac-soft': '253 236 211' });
  return t as CSSProperties;
}

export function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cx('mx-auto max-w-6xl scroll-mt-24 px-4', className)}>
      {children}
    </section>
  );
}
