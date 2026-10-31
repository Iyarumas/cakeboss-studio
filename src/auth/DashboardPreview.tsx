import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, LayoutGroup, animate, motion, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import { Boxes, Check, ClipboardList, Clock, LayoutDashboard, Percent, Search, ShoppingBag, Store, Truck, Wallet } from 'lucide-react';
import { cx } from '../components/ui';
import { BrandMark } from '../components/BrandMark';

/*
 * A miniature of the real CakeBoss admin (sidebar, top bar, screens) floating over the login photos.
 * It follows the photo: Dashboard, then Pedidos, then Financeiro. Values are example data and the
 * window says so in its title bar.
 */

const ease = [0.23, 1, 0.32, 1] as const;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function Counter({ to, format, delay = 0 }: { to: number; format: (v: number) => string; delay?: number }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) return;
    const c = animate(0, to, { duration: 1.1, delay, ease, onUpdate: setV });
    return () => c.stop();
  }, [to, delay, reduce]);
  return <span className="tabular-nums">{format(v)}</span>;
}

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Pedidos', icon: ShoppingBag },
  { label: 'Financeiro', icon: Wallet },
  { label: 'Fichas técnicas', icon: ClipboardList },
  { label: 'Estoque', icon: Boxes },
  { label: 'Loja online', icon: Store },
];

function Kpi({ label, icon, tone, children }: { label: string; icon: ReactNode; tone: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2">
      <div className="flex items-center justify-between text-[8px] font-medium text-zinc-500">
        {label}
        <span className={cx('grid h-4 w-4 place-items-center rounded', tone)}>{icon}</span>
      </div>
      <div className="mt-1 text-[13px] font-bold text-zinc-900">{children}</div>
    </div>
  );
}

const rise = (n: number) => ({ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: 0.15 + n * 0.06, ease } });

function DashboardScreen() {
  const bars = [0.42, 0.55, 0.38, 0.7, 0.62, 0.9];
  return (
    <div className="space-y-2">
      <motion.div {...rise(0)}>
        <div className="font-display text-[14px] font-extrabold text-zinc-900">Boa tarde, Letícia</div>
        <div className="text-[8px] text-zinc-500">Sábado, 31 de outubro · Doces da Lê</div>
      </motion.div>
      <motion.div {...rise(1)} className="grid grid-cols-3 gap-1.5">
        <Kpi label="Recebido no mês" icon={<Wallet size={9} />} tone="bg-emerald-100 text-emerald-600">
          <Counter to={4280} format={brl} delay={0.3} />
        </Kpi>
        <Kpi label="A receber" icon={<Clock size={9} />} tone="bg-amber-100 text-amber-600">
          <Counter to={960} format={brl} delay={0.4} />
        </Kpi>
        <Kpi label="Margem média" icon={<Percent size={9} />} tone="bg-emerald-100 text-emerald-600">
          <Counter to={34.2} format={(v) => `${v.toFixed(1).replace('.', ',')}%`} delay={0.5} />
        </Kpi>
      </motion.div>
      <div className="grid grid-cols-5 gap-1.5">
        <motion.div {...rise(2)} className="col-span-2 rounded-lg border border-zinc-200 bg-white p-2">
          <div className="mb-1.5 text-[9px] font-semibold text-zinc-900">Para hoje</div>
          {[
            { t: '2 entregas hoje', c: 'bg-pink-100 text-pink-600', i: <Truck size={8} /> },
            { t: '1 pedido novo da loja', c: 'bg-violet-100 text-violet-600', i: <Store size={8} /> },
            { t: '2 itens com estoque baixo', c: 'bg-amber-100 text-amber-600', i: <Boxes size={8} /> },
          ].map((r, n) => (
            <motion.div key={r.t} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + n * 0.12, duration: 0.35, ease }} className="flex items-center gap-1.5 border-t border-zinc-100 py-1 text-[8px] text-zinc-700 first:border-0">
              <span className={cx('grid h-3.5 w-3.5 place-items-center rounded', r.c)}>{r.i}</span>
              {r.t}
            </motion.div>
          ))}
        </motion.div>
        <motion.div {...rise(3)} className="col-span-3 rounded-lg border border-zinc-200 bg-white p-2">
          <div className="text-[9px] font-semibold text-zinc-900">Entradas e saídas</div>
          <div className="mt-1.5 flex h-[62px] items-end gap-1.5 border-b border-zinc-100">
            {bars.map((h, n) => (
              <div key={n} className="flex h-full flex-1 items-end gap-[2px]">
                <motion.div className="flex-1 origin-bottom rounded-t-sm bg-emerald-500" style={{ height: `${h * 100}%` }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.6, delay: 0.45 + n * 0.07, ease }} />
                <motion.div className="flex-1 origin-bottom rounded-t-sm bg-rose-400/80" style={{ height: `${h * 45}%` }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.6, delay: 0.5 + n * 0.07, ease }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[7px] text-zinc-400">
            {['mai', 'jun', 'jul', 'ago', 'set', 'out'].map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const COLS = ['Confirmado', 'Em produção', 'Pronto'];

function OrdersScreen() {
  const reduce = useReducedMotion();
  const [col, setCol] = useState(0);
  // order #12 walks across the board while the photo is on screen
  useEffect(() => {
    if (reduce) return;
    const a = window.setTimeout(() => setCol(1), 1400);
    const b = window.setTimeout(() => setCol(2), 3200);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [reduce]);
  const others: Record<number, string[]> = { 0: ['#14 · Bruno', '#15 · Carla'], 1: ['#11 · Diego'], 2: [] };
  return (
    <div>
      <motion.div {...rise(0)} className="mb-2 flex items-end justify-between">
        <div className="font-display text-[14px] font-extrabold text-zinc-900">Pedidos</div>
        <span className="rounded bg-pink-600 px-1.5 py-0.5 text-[8px] font-semibold text-white">+ Novo pedido</span>
      </motion.div>
      <LayoutGroup>
        <motion.div {...rise(1)} className="grid grid-cols-3 gap-1.5">
          {COLS.map((c, n) => (
            <div key={c} className={cx('min-h-[150px] rounded-lg border p-1.5 transition-colors duration-300', n === col ? 'border-pink-200 bg-pink-50' : 'border-zinc-200 bg-zinc-50')}>
              <div className="mb-1.5 flex items-center gap-1 text-[8px] font-semibold text-zinc-700">
                <span className={cx('h-1.5 w-1.5 rounded-full', ['bg-violet-500', 'bg-pink-500', 'bg-amber-500'][n])} />
                {c}
              </div>
              <div className="space-y-1">
                {n === col && (
                  <motion.div layoutId="mock-order" transition={{ type: 'spring', duration: 0.7, bounce: 0.18 }} className="rounded-md border border-pink-200 bg-white p-1.5 shadow-sm">
                    <div className="text-[8px] font-semibold text-zinc-900">#12 · Ana Souza</div>
                    <div className="text-[7px] text-zinc-500">1× Bolo de chocolate</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[8px] font-bold text-zinc-900">R$ 135</span>
                      <span className="rounded-full bg-emerald-100 px-1 text-[7px] font-medium text-emerald-700">Pago</span>
                    </div>
                  </motion.div>
                )}
                {others[n].map((o) => (
                  <div key={o} className="rounded-md border border-zinc-200 bg-white p-1.5">
                    <div className="text-[8px] font-medium text-zinc-800">{o}</div>
                    <div className="text-[7px] text-zinc-400">Brigadeiro gourmet</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      </LayoutGroup>
    </div>
  );
}

function FinanceScreen() {
  const reduce = useReducedMotion();
  const [saved, setSaved] = useState(!!reduce);
  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setSaved(true), 1800);
    return () => clearTimeout(t);
  }, [reduce]);
  const rows = [
    { d: 'Pedido #12 · Ana Souza', v: '+ R$ 135', in: true },
    { d: 'Compra: 6× leite condensado', v: '− R$ 48', in: false },
    { d: 'Pedido #9 · Bruno Lima', v: '+ R$ 175', in: true },
    { d: 'Caixas para bolo', v: '− R$ 60', in: false },
  ];
  return (
    <div className="space-y-2">
      <motion.div {...rise(0)} className="flex items-end justify-between">
        <div className="font-display text-[14px] font-extrabold text-zinc-900">Financeiro</div>
        <span className={cx('flex items-center gap-1 text-[8px] font-medium transition-colors', saved ? 'text-emerald-600' : 'text-zinc-500')}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={saved ? 'ok' : 'up'} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ duration: 0.2 }} className="inline-flex">
              {saved ? <Check size={9} strokeWidth={3} /> : <span className="h-2 w-2 animate-spin rounded-full border border-zinc-400 border-t-transparent" />}
            </motion.span>
          </AnimatePresence>
          {saved ? 'Salvo na nuvem' : 'Salvando…'}
        </span>
      </motion.div>
      <motion.div {...rise(1)} className="grid grid-cols-3 gap-1.5">
        <Kpi label="Entradas" icon={<Wallet size={9} />} tone="bg-emerald-100 text-emerald-600">
          <Counter to={4280} format={brl} delay={0.3} />
        </Kpi>
        <Kpi label="Saídas" icon={<Wallet size={9} />} tone="bg-rose-100 text-rose-600">
          <Counter to={1310} format={brl} delay={0.4} />
        </Kpi>
        <Kpi label="Saldo" icon={<Percent size={9} />} tone="bg-pink-100 text-pink-600">
          <span className="text-pink-600">
            <Counter to={2970} format={brl} delay={0.5} />
          </span>
        </Kpi>
      </motion.div>
      <motion.div {...rise(2)} className="rounded-lg border border-zinc-200 bg-white p-2">
        <div className="mb-1 text-[9px] font-semibold text-zinc-900">Lançamentos</div>
        {rows.map((r, n) => (
          <motion.div key={r.d} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 + n * 0.1, duration: 0.35, ease }} className="flex items-center justify-between border-t border-zinc-100 py-1 text-[8px] first:border-0">
            <span className="text-zinc-700">{r.d}</span>
            <span className={cx('font-semibold tabular-nums', r.in ? 'text-emerald-600' : 'text-rose-500')}>{r.v}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

const SCREENS = [DashboardScreen, OrdersScreen, FinanceScreen];

/**
 * Full app window in 3D: tilted toward the form, it leans further with the pointer. The screen inside
 * changes with the photo, and the sidebar highlight slides to the matching menu item.
 */
export function DashboardPreview({ index, px, py }: { index: number; px: MotionValue<number>; py: MotionValue<number> }) {
  const rotateY = useTransform(px, (v) => -12 + v * 10);
  const rotateX = useTransform(py, (v) => 5 - v * 8);
  const x = useTransform(px, (v) => v * 30);
  const y = useTransform(py, (v) => v * 20);
  const Screen = SCREENS[index] ?? DashboardScreen;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[12%] flex justify-center" style={{ perspective: 1400 }} aria-hidden="true">
      <motion.div
        initial={{ opacity: 0, y: 60, rotateX: 24, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        transition={{ type: 'spring', duration: 1.1, bounce: 0.15, delay: 0.25 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <motion.div
          style={{ rotateY, rotateX, x, y, transformStyle: 'preserve-3d' }}
          className="w-[560px] overflow-hidden rounded-xl border border-white/40 bg-[#F8F9FC] shadow-[0_50px_100px_-30px_rgb(0_0_0/0.75),0_20px_40px_-20px_rgb(0_0_0/0.5)]"
        >
          <div className="flex items-center gap-1.5 border-b border-zinc-200 bg-white px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
            <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
            <span className="h-2 w-2 rounded-full bg-[#28c840]" />
            <div className="mx-auto flex h-4 w-48 items-center justify-center gap-1 rounded bg-zinc-100 text-[8px] text-zinc-500">
              <Search size={7} /> Buscar pedido, cliente, ficha…
            </div>
            <span className="rounded bg-amber-100 px-1 text-[7px] font-medium text-amber-700">dados de exemplo</span>
          </div>
          <div className="grid h-[318px] grid-cols-[118px_minmax(0,1fr)]">
            <aside className="border-r border-zinc-200 bg-white p-2">
              <div className="mb-2.5 flex items-center gap-1.5 px-1">
                <BrandMark size={20} className="rounded-md" />
                <span className="font-display text-[11px] font-extrabold text-zinc-900">CakeBoss</span>
              </div>
              <ul className="space-y-0.5">
                {NAV.map((n, k) => (
                  <li key={n.label} className={cx('relative flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[8.5px] font-medium transition-colors duration-300', k === index ? 'text-pink-600' : 'text-zinc-500')}>
                    {k === index && <motion.span layoutId="mock-nav" className="absolute inset-0 rounded-md border border-pink-200 bg-pink-50" transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }} />}
                    <n.icon size={10} className="relative" />
                    <span className="relative">{n.label}</span>
                  </li>
                ))}
              </ul>
            </aside>
            <div className="relative overflow-hidden">
              <AnimatePresence initial={false}>
                <motion.div
                  key={index}
                  className="absolute inset-0 p-3"
                  initial={{ opacity: 0, x: 24, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, x: -24, filter: 'blur(4px)' }}
                  transition={{ duration: 0.45, ease }}
                >
                  <Screen />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
