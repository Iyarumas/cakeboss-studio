import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Store, ShoppingCart, ShoppingBag, Users, Wallet, Boxes, Calculator, Cake, ClipboardList, Factory, LayoutDashboard, Menu, Moon, Package, ScrollText, Settings, Sparkles, Sun, Wheat, X, Flame } from 'lucide-react';
import { useStore } from '../store/store';
import { cx } from '../components/ui';
import { useToast } from '../components/motion';
import { Mascot } from '../components/mascot/Mascot';
import { Onboarding } from '../components/Onboarding';
import { qtyBase } from '../lib/format';

const NAV: { group: string; items: { to: string; label: string; icon: ReactNode; highlight?: boolean }[] }[] = [
  { group: 'Visão geral', items: [{ to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> }] },
  {
    group: 'Produção',
    items: [
      { to: '/ingredientes', label: 'Ingredientes', icon: <Wheat size={18} /> },
      { to: '/materiais', label: 'Embalagens e adesivos', icon: <Package size={18} /> },
      { to: '/compras', label: 'Compras', icon: <ShoppingCart size={18} /> },
      { to: '/fichas', label: 'Fichas técnicas', icon: <ClipboardList size={18} /> },
      { to: '/producoes', label: 'Produções', icon: <Factory size={18} /> },
      { to: '/estoque', label: 'Estoque', icon: <Boxes size={18} /> },
    ],
  },
  {
    group: 'Gestão',
    items: [
      { to: '/pedidos', label: 'Pedidos', icon: <ShoppingBag size={18} /> },
      { to: '/clientes', label: 'Clientes', icon: <Users size={18} /> },
      { to: '/financeiro', label: 'Financeiro', icon: <Wallet size={18} /> },
      { to: '/loja-online', label: 'Loja online', icon: <Store size={18} /> },
    ],
  },
  {
    group: 'Ferramentas',
    items: [
      { to: '/assistente', label: 'Assistente de Precificação', icon: <Calculator size={18} />, highlight: true },
      { to: '/custos', label: 'Custos operacionais', icon: <Flame size={18} /> },
    ],
  },
  {
    group: 'Sistema',
    items: [
      { to: '/historico', label: 'Histórico', icon: <ScrollText size={18} /> },
      { to: '/configuracoes', label: 'Configurações', icon: <Settings size={18} /> },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { db, updateSettings } = useStore();
  const lowStock =
    db.ingredients.filter((i) => i.minStock > 0 && i.stock <= i.minStock).length + db.materials.filter((m) => m.minStock > 0 && m.stock <= m.minStock).length;
  const dark = db.settings.theme === 'dark';
  // confirmed orders due by the end of tomorrow (or late)
  const soon = new Date();
  soon.setDate(soon.getDate() + 1);
  soon.setHours(23, 59, 59, 999);
  const dueOrders = db.orders.filter((o) => o.status !== 'orcamento' && o.status !== 'entregue' && o.status !== 'cancelado' && new Date(o.deliveryAt) <= soon).length;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-divider px-5 py-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-pink to-lilac text-white shadow-sm">
          <Cake size={20} />
        </span>
        <div className="min-w-0">
          <div className="text-[17px] font-bold tracking-tight text-ink">DoceGestão</div>
          <div className="truncate text-xs text-muted">{db.settings.businessName || 'Confeitaria artesanal'}</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Principal">
        {NAV.map((g) => (
          <div key={g.group} className="mb-5">
            <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted/80">{g.group}</div>
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cx(
                        'relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                        isActive ? 'text-pink' : 'text-muted hover:bg-subtle hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg border border-pink/20 bg-pink-soft" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
                        )}
                        <span className="relative">{it.icon}</span>
                        <span className="relative flex-1 truncate">{it.label}</span>
                        {it.highlight && !isActive && <Sparkles size={14} className="relative text-lilac" />}
                        {it.to === '/pedidos' && dueOrders > 0 && (
                          <span className="relative grid h-5 min-w-5 place-items-center rounded-full bg-pink px-1.5 text-[11px] font-semibold text-white" title="Entregas até amanhã">
                            {dueOrders}
                          </span>
                        )}
                        {it.to === '/estoque' && lowStock > 0 && <span className="relative grid h-5 min-w-5 place-items-center rounded-full bg-warn px-1.5 text-[11px] font-semibold text-white">{lowStock}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-2 border-t border-divider p-3">
        <a
          href="/loja"
          target="_blank"
          rel="noreferrer"
          className="flex h-10 w-full items-center gap-3 rounded-lg bg-gradient-to-r from-pink to-lilac px-3 text-sm font-semibold text-white shadow-sm hover:opacity-95"
        >
          <Store size={17} />
          <span className="flex-1 text-left">Ver loja dos clientes</span>
          <span aria-hidden="true">↗</span>
        </a>
        <button
          type="button"
          onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}
          className="flex h-10 w-full items-center gap-3 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-subtle"
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
          <span className="flex-1 text-left">{dark ? 'Tema claro' : 'Tema escuro'}</span>
        </button>
      </div>
    </div>
  );
}

/** Warns once when an item drops to (or below) its minimum stock, wherever the drop came from. */
function StockWatcher() {
  const { db } = useStore();
  const toast = useToast();
  const prev = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    const items = [
      ...db.ingredients.map((i) => ({ id: i.id, name: i.name, stock: i.stock, min: i.minStock, label: qtyBase(i.stock, i.unit) })),
      ...db.materials.map((m) => ({ id: m.id, name: m.name, stock: m.stock, min: m.minStock, label: `${m.stock} un` })),
    ];
    const before = prev.current;
    prev.current = new Map(items.map((x) => [x.id, x.stock]));
    if (!before) return;
    const crossed = items.filter((x) => x.min > 0 && x.stock <= x.min && (before.get(x.id) ?? Infinity) > x.min);
    for (const x of crossed) toast(x.stock <= 0 ? `Acabou: ${x.name}` : `Estoque baixo: ${x.name} (restam ${x.label})`, 'error');
  }, [db.ingredients, db.materials, toast]);
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const { db, persistError } = useStore();
  useEffect(() => setOpen(false), [loc.pathname]);
  const hasSample = db.recipes.some((r) => r.sample) || db.ingredients.some((i) => i.sample) || db.materials.some((m) => m.sample);

  return (
    <div className="min-h-screen bg-bg">
      <StockWatcher />
      <Mascot />
      <Onboarding />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        <button className="rounded-lg p-2 text-ink hover:bg-subtle" onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu size={20} />
        </button>
        <span className="flex items-center gap-2 font-bold">
          <Cake size={18} className="text-pink" /> DoceGestão
        </span>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 w-[280px] border-r border-line bg-surface shadow-pop"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            >
              <button className="absolute right-3 top-5 rounded-lg p-1.5 text-muted hover:bg-subtle" onClick={() => setOpen(false)} aria-label="Fechar menu">
                <X size={18} />
              </button>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="lg:pl-[264px]">
        {(hasSample || persistError) && (
          <div className="border-b border-line bg-surface px-4 py-2 text-center text-xs text-muted sm:px-8">
            {persistError ? (
              <span className="text-loss">Não foi possível salvar no navegador (armazenamento cheio ou bloqueado). Suas alterações podem se perder.</span>
            ) : (
              <span>
                Há <b className="text-warn">dados de exemplo</b> carregados (marcados com “exemplo”). Os preços não são cotações reais — remova-os em Configurações quando cadastrar os seus.
              </span>
            )}
          </div>
        )}
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
