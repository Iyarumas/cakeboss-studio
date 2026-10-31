import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CornerDownLeft, Moon, Plus, Search, ShoppingBag, ShoppingCart, Sun, User, Wheat } from 'lucide-react';
import { useStore } from '../store/store';
import { NAV } from '../layout/nav';
import { money, relativeDay } from '../lib/format';
import { STATUS } from '../lib/orders';
import { cx } from './ui';

interface Cmd {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  /** text the query is matched against (label is always included) */
  words?: string;
  run: () => void;
}

const PaletteCtx = createContext<() => void>(() => {});
/** Opens the command palette (also bound to Ctrl/⌘ + K). */
export const useCommandPalette = () => useContext(PaletteCtx);

// "Pão de mel" matches "pao de mel"
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  return (
    <PaletteCtx.Provider value={show}>
      {children}
      {open && <Palette onClose={() => setOpen(false)} />}
    </PaletteCtx.Provider>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const { db, updateSettings } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const go = useCallback((to: string) => () => navigate(to), [navigate]);
  const dark = db.settings.theme === 'dark';

  const all = useMemo<Cmd[]>(() => {
    const actions: Cmd[] = [
      { id: 'a-pedido', group: 'Ações', label: 'Novo pedido', icon: <Plus size={16} />, words: 'encomenda venda', run: go('/pedidos?novo=1') },
      { id: 'a-ficha', group: 'Ações', label: 'Nova ficha técnica', icon: <Plus size={16} />, words: 'receita produto', run: go('/fichas/nova') },
      { id: 'a-compra', group: 'Ações', label: 'Registrar compra', icon: <ShoppingCart size={16} />, words: 'mercado estoque', run: go('/compras') },
      {
        id: 'a-tema',
        group: 'Ações',
        label: dark ? 'Usar tema claro' : 'Usar tema escuro',
        icon: dark ? <Sun size={16} /> : <Moon size={16} />,
        words: 'tema aparencia modo',
        run: () => updateSettings({ theme: dark ? 'light' : 'dark' }),
      },
    ];
    const pages: Cmd[] = NAV.flatMap((g) => g.items.map((it) => ({ id: `p-${it.to}`, group: 'Ir para', label: it.label, icon: it.icon, words: it.keywords, run: go(it.to) })));
    const orders: Cmd[] = [...db.orders]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((o) => ({
        id: `o-${o.id}`,
        group: 'Pedidos',
        label: `#${o.number} · ${o.customerName || 'sem cliente'}`,
        hint: `${STATUS[o.status].label} · ${relativeDay(o.deliveryAt)}`,
        icon: <ShoppingBag size={16} />,
        words: o.items.map((i) => i.name).join(' '),
        run: go(`/pedidos?pedido=${o.id}`),
      }));
    const customers: Cmd[] = db.customers.map((c) => ({
      id: `c-${c.id}`,
      group: 'Clientes',
      label: c.name,
      hint: 'ver pedidos',
      icon: <User size={16} />,
      words: `${c.phone ?? ''} ${c.email ?? ''}`,
      run: go(`/pedidos?cliente=${c.id}`),
    }));
    const recipes: Cmd[] = db.recipes.map((r) => ({
      id: `r-${r.id}`,
      group: 'Fichas técnicas',
      label: r.name,
      hint: r.salePrice != null ? money(r.salePrice) : 'sem preço',
      icon: <ClipboardList size={16} />,
      run: go(`/fichas/${r.id}`),
    }));
    const ingredients: Cmd[] = db.ingredients.map((i) => ({ id: `i-${i.id}`, group: 'Ingredientes', label: i.name, icon: <Wheat size={16} />, run: go('/ingredientes') }));
    return [...actions, ...pages, ...orders, ...customers, ...recipes, ...ingredients];
  }, [db, dark, go, updateSettings]);

  const results = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    // with no query, only actions, pages and the latest orders are listed
    if (!terms.length) return all.filter((c) => c.group === 'Ações' || c.group === 'Ir para').concat(all.filter((c) => c.group === 'Pedidos').slice(0, 4));
    const perGroup = new Map<string, number>();
    return all.filter((c) => {
      const hay = norm(`${c.label} ${c.words ?? ''} ${c.hint ?? ''}`);
      if (!terms.every((t) => hay.includes(t))) return false;
      const n = (perGroup.get(c.group) ?? 0) + 1;
      perGroup.set(c.group, n);
      return n <= 6;
    });
  }, [all, q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (c: Cmd | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let index = -1;
  const groups = [...new Set(results.map((c) => c.group))];

  // opened from the keyboard many times a day: it appears instantly, no entrance animation
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={onKey}>
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Busca rápida" className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-divider px-4">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pedido, cliente, ficha ou tela…"
            aria-label="Buscar"
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
            className="h-14 w-full bg-transparent text-[15px] text-ink placeholder:text-muted/80 focus:outline-none"
          />
          <kbd className="shrink-0 rounded-md border border-line bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-muted">Esc</kbd>
        </div>
        <div ref={list} id="palette-list" role="listbox" className="overflow-y-auto overscroll-contain p-2">
          {results.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted">
              Nada encontrado para “{q}”. Tente o número do pedido ou o nome do cliente.
            </p>
          ) : (
            groups.map((g) => (
              <div key={g} className="mb-1 last:mb-0">
                <div className="px-3 pb-1 pt-2 text-xs font-medium text-muted">{g}</div>
                {results
                  .filter((c) => c.group === g)
                  .map((c) => {
                    index += 1;
                    const i = index;
                    const on = i === active;
                    return (
                      <div
                        key={c.id}
                        id={`cmd-${c.id}`}
                        role="option"
                        aria-selected={on}
                        data-index={i}
                        onMouseMove={() => active !== i && setActive(i)}
                        onClick={() => run(c)}
                        className={cx('flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm', on ? 'bg-pink-soft text-ink' : 'text-ink')}
                      >
                        <span className={cx('shrink-0 [&>svg]:h-4 [&>svg]:w-4', on ? 'text-pink' : 'text-muted')}>{c.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{c.label}</span>
                        {c.hint && <span className="shrink-0 truncate text-xs text-muted">{c.hint}</span>}
                        {on && <CornerDownLeft size={14} className="shrink-0 text-pink" aria-hidden="true" />}
                      </div>
                    );
                  })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-divider px-4 py-2 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-line bg-subtle px-1">↑</kbd>
            <kbd className="rounded border border-line bg-subtle px-1">↓</kbd> navegar
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-line bg-subtle px-1">Enter</kbd> abrir
          </span>
          <span className="ml-auto">{isMac ? '⌘' : 'Ctrl'} K abre de qualquer tela</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
