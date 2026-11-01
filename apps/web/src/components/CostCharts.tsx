import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { CategoryKey, CostCategory } from '@cakeboss/domain/pricing';
import { money, pct } from '@cakeboss/domain/format';
import { AnimatedCounter } from './motion';
import { cx } from './ui';

function OriginList({ c, per }: { c: CostCategory; per: string }) {
  return (
    <div className="max-w-[260px] space-y-1">
      <div className="flex items-center gap-2 font-semibold">
        <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
        {c.label}
      </div>
      <div className="tabular">
        {money(c.perUnit)} por {per} · {money(c.total)} no total · {pct(c.pct)}
      </div>
      {c.origin.length > 0 && (
        <ul className="space-y-0.5 border-t border-divider pt-1 text-muted">
          {c.origin.slice(0, 6).map((o, i) => (
            <li key={i}>{o}</li>
          ))}
          {c.origin.length > 6 && <li>+ {c.origin.length - 6} itens</li>}
        </ul>
      )}
    </div>
  );
}

export function CostDonut({
  categories,
  center,
  centerLabel,
  per = 'unidade',
  active,
  onActive,
  size = 220,
}: {
  categories: CostCategory[];
  center: number;
  centerLabel: string;
  per?: string;
  active?: CategoryKey | null;
  onActive?: (k: CategoryKey | null) => void;
  size?: number;
}) {
  const reduce = useReducedMotion();
  const data = categories.filter((c) => c.total > 0.0049);
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {data.length === 0 ? (
        <div className="grid h-full w-full place-items-center rounded-full border-[18px] border-divider " />
      ) : (
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="label"
              innerRadius="68%"
              outerRadius="96%"
              paddingAngle={data.length > 1 ? 1.5 : 0}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={!reduce}
              animationDuration={450}
              onMouseEnter={(_, i) => onActive?.(data[i].key)}
              onMouseLeave={() => onActive?.(null)}
            >
              {data.map((c) => (
                <Cell key={c.key} fill={c.color} opacity={active && active !== c.key ? 0.35 : 1} style={{ transition: 'opacity .2s', outline: 'none' }} />
              ))}
            </Pie>
            <Tooltip
              wrapperStyle={{ zIndex: 40, outline: 'none' }}
              content={({ active: a, payload }) =>
                a && payload?.[0] ? (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink shadow-pop">
                    <OriginList c={payload[0].payload as CostCategory} per={per} />
                  </div>
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
      )}
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          {size >= 140 && (
            <>
              <AnimatedCounter value={center} format={money} className="block text-xl font-bold text-ink" />
              <span className="text-xs text-muted">{centerLabel}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Ranked, animated progress bars. Briefly highlights a category whose cost went up. */
export function CostBars({
  categories,
  per = 'unidade',
  active,
  onActive,
  limit,
}: {
  categories: CostCategory[];
  per?: string;
  active?: CategoryKey | null;
  onActive?: (k: CategoryKey | null) => void;
  limit?: number;
}) {
  const sorted = [...categories].filter((c) => c.total > 0.0049).sort((a, b) => b.total - a.total);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  const max = sorted[0]?.total || 1;
  const prev = useRef<Record<string, number>>({});
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<CategoryKey | null>(null);

  useEffect(() => {
    const up: Record<string, number> = {};
    for (const c of categories) {
      const before = prev.current[c.key];
      if (before !== undefined && c.perUnit > before + 0.005) up[c.key] = Date.now();
      prev.current[c.key] = c.perUnit;
    }
    if (Object.keys(up).length) {
      setFlash((f) => ({ ...f, ...up }));
      setTimeout(() => setFlash((f) => Object.fromEntries(Object.entries(f).filter(([k, at]) => !(k in up) || at !== up[k]))), 1400);
    }
  }, [categories]);

  if (!shown.length) return <p className="py-6 text-center text-sm text-muted">Adicione itens à composição para ver os custos.</p>;

  return (
    <ul className="space-y-1">
      <AnimatePresence initial={false}>
        {shown.map((c) => {
          const isFlash = !!flash[c.key];
          const expanded = open === c.key;
          return (
            <motion.li
              key={c.key}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              onMouseEnter={() => onActive?.(c.key)}
              onMouseLeave={() => onActive?.(null)}
              className={cx('rounded-lg transition-colors', (active === c.key || expanded) && 'bg-subtle')}
            >
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : c.key)}
                aria-expanded={expanded}
                className="w-full rounded-lg px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/30"
              >
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.color }} />
                    <span className="truncate font-medium text-ink">{c.label}</span>
                    <AnimatePresence>
                      {isFlash && (
                        <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-0.5 rounded-full bg-loss-soft px-1.5 text-[10px] font-semibold text-loss">
                          <TrendingUp size={10} /> subiu
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <span className="shrink-0 tabular text-muted">
                    <AnimatedCounter value={c.perUnit} format={money} className={cx('font-semibold', isFlash ? 'text-loss' : 'text-ink')} /> · {pct(c.pct, 0)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-divider">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: c.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(c.total / max) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 160, damping: 24 }}
                  />
                </div>
              </button>
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 38 }}
                    className="overflow-hidden"
                  >
                    <ul className="space-y-0.5 px-2 pb-2 pl-6 text-xs text-muted">
                      {c.origin.length ? c.origin.map((o, i) => <li key={i}>{o}</li>) : <li>Sem detalhamento.</li>}
                      <li className="pt-1 text-ink">
                        Total da produção: <b className="tabular">{money(c.total)}</b> · por {per}: <b className="tabular">{money(c.perUnit)}</b>
                      </li>
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
