import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Menu, Moon, Plus, Search, Sparkles, Store, Sun, X } from 'lucide-react';
import { useStore } from '../store/store';
import { Button, IconButton, cx } from '../components/ui';
import { useToast } from '../components/motion';
import { Mascot } from '../components/mascot/Mascot';
import { Onboarding } from '../components/Onboarding';
import { CommandPaletteProvider, isMac, useCommandPalette } from '../components/CommandPalette';
import { qtyBase } from '../lib/format';
import { NAV } from './nav';
import { AccountMenu, SaveIndicator } from './AccountMenu';
import { AccentStyle } from '../components/AccentPicker';
import { BrandLockup } from '../components/BrandMark';

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { db } = useStore();
  const loc = useLocation();
  // "/fichas" and "/fichas?aba=bolos" share a path: tell them apart by the query
  const activeFor = (to: string, isActive: boolean) => (to.startsWith('/fichas') ? isActive && (to.includes('aba=bolos') === loc.search.includes('aba=bolos')) : isActive);
  const lowStock =
    db.ingredients.filter((i) => i.minStock > 0 && i.stock <= i.minStock).length + db.materials.filter((m) => m.minStock > 0 && m.stock <= m.minStock).length;
  // confirmed orders due by the end of tomorrow (or late)
  const soon = new Date();
  soon.setDate(soon.getDate() + 1);
  soon.setHours(23, 59, 59, 999);
  const dueOrders = db.orders.filter((o) => o.status !== 'orcamento' && o.status !== 'entregue' && o.status !== 'cancelado' && new Date(o.deliveryAt) <= soon).length;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-divider px-5 py-5">
        <div className="min-w-0">
          <BrandLockup height={30} />
          <div className="mt-1 truncate text-xs text-muted">{db.settings.businessName || 'Confeitaria artesanal'}</div>
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
                        activeFor(it.to, isActive) ? 'text-pink' : 'text-muted hover:bg-subtle hover:text-ink',
                      )
                    }
                  >
                    {({ isActive: navActive }) => {
                      const isActive = activeFor(it.to, navActive);
                      return (
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
                      );
                    }}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-divider p-3">
        <a
          href="/loja"
          target="_blank"
          rel="noreferrer"
          className="flex h-10 w-full items-center gap-3 rounded-lg bg-gradient-to-r from-pink to-pink-deep px-3 text-sm font-semibold text-white shadow-sm transition-[opacity,transform] duration-150 ease-out hover:opacity-95 active:scale-[0.97]"
        >
          <Store size={17} />
          <span className="flex-1 text-left">Ver loja dos clientes</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

/** Search, the most common action and the theme switch — on every admin screen. */
function TopBar({ onMenu }: { onMenu: () => void }) {
  const { db, updateSettings } = useStore();
  const openPalette = useCommandPalette();
  const navigate = useNavigate();
  const dark = db.settings.theme === 'dark';
  const initials =
    (db.settings.ownerName || db.settings.businessName || 'DG')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || 'DG';
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4 sm:px-6 lg:px-8">
        <IconButton label="Abrir menu" className="lg:hidden" onClick={onMenu}>
          <Menu size={20} />
        </IconButton>
        <span className="flex items-center gap-2 font-bold lg:hidden">
          <BrandLockup height={22} />
        </span>
        <button
          type="button"
          onClick={openPalette}
          className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-line bg-subtle px-3 text-sm text-muted transition-colors hover:border-pink/30 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 lg:ml-0 lg:w-80"
        >
          <Search size={16} />
          <span className="hidden flex-1 text-left sm:inline">Buscar pedido, cliente, ficha…</span>
          <kbd className="hidden rounded border border-line bg-surface px-1.5 text-[11px] font-medium sm:inline">{isMac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        <div className="flex items-center gap-2 lg:ml-auto">
          <Button size="sm" variant="primary" onClick={() => navigate('/pedidos?novo=1')} className="hidden sm:inline-flex">
            <Plus size={15} /> Novo pedido
          </Button>
          <IconButton label={dark ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </IconButton>
          <SaveIndicator />
          <AccountMenu initials={initials} ownerName={db.settings.ownerName} />
        </div>
      </div>
    </header>
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
    <CommandPaletteProvider>
    <div className="min-h-screen bg-bg">
      <StockWatcher />
      <AccentStyle choice={db.settings.accentAdmin} />
      <Mascot />
      <Onboarding />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

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
        <TopBar onMenu={() => setOpen(true)} />
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
    </CommandPaletteProvider>
  );
}
