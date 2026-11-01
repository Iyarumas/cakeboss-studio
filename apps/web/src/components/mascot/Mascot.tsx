import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronRight, X } from 'lucide-react';
import { useStore } from '../../store/store';
import { useToast } from '../motion';
import { cx } from '../ui';
import { MascotSvg, characterName, type Character, type Mood } from './MascotSvg';
import { buildTips, type Tip } from './tips';

const W = 72;
const H = 84;
const PAD = 10; // empty margin required around the mascot
const SEEN_KEY = 'docegestao:mascote';
const VIEWED_KEY = 'docegestao:mascote:lidos';
const ORDERS_KEY = 'docegestao:mascote:pedidos';

const readList = (key: string): string[] | null => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as string[]) : null;
  } catch {
    return null;
  }
};
const writeList = (key: string, ids: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(ids.slice(-500)));
  } catch {
    /* storage blocked: badge may come back after reload, nothing else breaks */
  }
};

type Pos = { x: number; y: number };

/** viewport size without scrollbars */
const vwNow = () => document.documentElement.clientWidth;
const vhNow = () => document.documentElement.clientHeight;

/** Remembers which alerts were already announced today (per browser; only a convenience). */
function readSeen(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as { day?: string; ids?: string[] };
    return new Set(raw.day === new Date().toDateString() ? raw.ids : []);
  } catch {
    return new Set();
  }
}
function writeSeen(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ day: new Date().toDateString(), ids: [...ids] }));
  } catch {
    /* storage blocked: alerts may repeat, nothing else breaks */
  }
}

/**
 * Probe for empty page background. A point is free only when the element under it — and
 * every ancestor up to <body> — has no background of its own, border or shadow, and the
 * element itself is not text, media or a control. Results are cached per element during one scan.
 */
function makeProbe(self: HTMLElement | null) {
  const pageBg = getComputedStyle(document.body).backgroundColor;
  const cache = new Map<Element, boolean>();
  const boxed = (el: Element): boolean => {
    if (el === document.body || el === document.documentElement) return false;
    const hit = cache.get(el);
    if (hit !== undefined) return hit;
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const own =
      (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== pageBg) ||
      parseFloat(cs.borderTopWidth) > 0 ||
      parseFloat(cs.borderBottomWidth) > 0 ||
      parseFloat(cs.borderLeftWidth) > 0 ||
      cs.boxShadow !== 'none';
    const res = own || (el.parentElement ? boxed(el.parentElement) : false);
    cache.set(el, res);
    return res;
  };
  return (x: number, y: number): boolean => {
    const el = document.elementsFromPoint(x, y).find((e) => !self?.contains(e));
    if (!el) return false;
    if (el === document.documentElement || el === document.body) return true;
    if (el instanceof SVGElement || /^(BUTTON|INPUT|SELECT|TEXTAREA|A|IMG|CANVAS|LABEL|TABLE|TD|TH|TR|LI|P|SPAN|H1|H2|H3|H4|B|I|ASIDE|HEADER|NAV)$/.test(el.tagName)) return false;
    for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) return false;
    return !boxed(el);
  };
}

type Probe = ReturnType<typeof makeProbe>;

function isFreeRect(p: Pos, probe: Probe, minX: number): boolean {
  const x0 = p.x - PAD;
  const y0 = p.y - PAD;
  const w = W + PAD * 2;
  const h = H + PAD * 2;
  if (x0 < minX || y0 < 0 || x0 + w > vwNow() || y0 + h > vhNow()) return false;
  for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3; j++) if (!probe(x0 + 1 + ((w - 2) * i) / 3, y0 + 1 + ((h - 2) * j) / 3)) return false;
  return true;
}

/** Nearest free spot to `from`, scanning a coarse grid. */
function findSpot(from: Pos, self: HTMLElement | null, minX: number, maxDist = Infinity): Pos | null {
  const probe = makeProbe(self);
  const step = 28;
  const cands: (Pos & { d: number })[] = [];
  for (let x = minX + PAD; x <= vwNow() - W - PAD; x += step)
    for (let y = PAD; y <= vhNow() - H - PAD; y += step) {
      const d = Math.hypot(x - from.x, y - from.y);
      if (d <= maxDist) cands.push({ x, y, d });
    }
  cands.sort((a, b) => a.d - b.d);
  for (const c of cands.slice(0, 1600)) if (isFreeRect(c, probe, minX)) return { x: c.x, y: c.y };
  return null;
}

function pathClear(a: Pos, b: Pos, self: HTMLElement | null, minX: number) {
  const probe = makeProbe(self);
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 40);
  for (let i = 1; i < n; i++) if (!isFreeRect({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }, probe, minX)) return false;
  return true;
}

type Role = 'tudo' | 'pedidos' | 'financas';
type Interaction = { kind: 'danca' | 'aceno' | 'doce'; from: 0 | 1; id: number } | null;

const ROLE_LABEL: Record<Role, string> = { tudo: '', pedidos: 'pedidos', financas: 'finanças e estoque' };

/**
 * One or two helper mascots. With two, each takes a topic (orders vs. finances/stock) and,
 * every now and then, they play together: dance, wave at each other or toss a treat.
 */
export function Mascot() {
  const { db, ctx } = useStore();
  const loc = useLocation();
  const reduce = useReducedMotion();
  // hidden during the first-access welcome, which has its own mascots
  const enabled = db.settings.mascotEnabled !== false && !!db.settings.onboarded;
  const first = db.settings.mascotCharacter ?? 'docinho';
  const second = db.settings.mascotSecond ?? null;
  const firstRole: Role = second ? (db.settings.mascotFirstRole ?? 'pedidos') : 'tudo';
  const actors: { character: Character; role: Role }[] = [{ character: first, role: firstRole }];
  if (second) actors.push({ character: second, role: firstRole === 'pedidos' ? 'financas' : 'pedidos' });

  const allTips = useMemo(() => buildTips(db, ctx, loc.pathname, characterName(first)), [db, ctx, loc.pathname, first]);
  const places = useRef<(Pos | null)[]>([null, null]);
  const talking = useRef<boolean[]>([false, false]);
  const [interaction, setInteraction] = useState<Interaction>(null);
  const [celebrate, setCelebrate] = useState<{ id: number; tipId: string } | null>(null);

  // new order → everybody celebrates; the orders mascot holds the sign and tells about it
  useEffect(() => {
    if (!enabled) return;
    const known = readList(ORDERS_KEY);
    const ids = db.orders.map((o) => o.id);
    if (!known) return writeList(ORDERS_KEY, ids); // first run: don't celebrate old orders
    const fresh = db.orders.filter((o) => !known.includes(o.id) && o.status !== 'cancelado');
    if (!fresh.length) return;
    writeList(ORDERS_KEY, [...known, ...fresh.map((o) => o.id)]);
    const newest = fresh.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    setCelebrate({ id: Date.now(), tipId: `new-${newest.id}` });
    const t = window.setTimeout(() => setCelebrate(null), 6500);
    return () => clearTimeout(t);
  }, [db.orders, enabled]);

  // two mascots: play together from time to time
  useEffect(() => {
    if (!enabled || !second || reduce) return;
    let t: number;
    const schedule = () => {
      t = window.setTimeout(() => {
        if (!document.hidden && !talking.current[0] && !talking.current[1] && places.current[0] && places.current[1]) {
          const kinds = ['danca', 'aceno', 'doce'] as const;
          setInteraction({ kind: kinds[Math.floor(Math.random() * kinds.length)], from: Math.random() < 0.5 ? 0 : 1, id: Date.now() });
          window.setTimeout(() => setInteraction(null), 3600);
        }
        schedule();
      }, 28000 + Math.random() * 22000);
    };
    // they say hi to each other right after appearing together
    const hello = window.setTimeout(() => setInteraction({ kind: 'aceno', from: 0, id: Date.now() }), 2500);
    const bye = window.setTimeout(() => setInteraction(null), 5500);
    schedule();
    return () => {
      clearTimeout(t);
      clearTimeout(hello);
      clearTimeout(bye);
    };
  }, [enabled, second, reduce]);

  if (!enabled) return null;

  const tipsFor = (role: Role, slot: number) => (role === 'tudo' ? allTips : allTips.filter((t) => t.topic === role || (!t.topic && slot === 0)));
  const orderSlot = actors.findIndex((a) => a.role === 'pedidos' || a.role === 'tudo');

  return (
    <>
      {actors.map((a, slot) => (
        <MascotActor
          key={`${slot}-${a.character}`}
          slot={slot as 0 | 1}
          character={a.character}
          role={a.role}
          tips={tipsFor(a.role, slot)}
          partner={actors.length > 1 ? () => places.current[slot === 0 ? 1 : 0] : null}
          interaction={interaction}
          celebrate={celebrate}
          announcesOrders={slot === orderSlot}
          onPlace={(p) => {
            places.current[slot] = p;
          }}
          onTalking={(v) => {
            talking.current[slot] = v;
          }}
        />
      ))}
      <AnimatePresence>
        {interaction?.kind === 'doce' && places.current[0] && places.current[1] && (
          <FlyingTreat key={interaction.id} from={places.current[interaction.from]!} to={places.current[interaction.from === 0 ? 1 : 0]!} />
        )}
      </AnimatePresence>
    </>
  );
}

/** A little candy thrown in an arc from one mascot to the other. */
function FlyingTreat({ from, to }: { from: Pos; to: Pos }) {
  const sx = from.x + W / 2;
  const sy = from.y + 20;
  const ex = to.x + W / 2;
  const ey = to.y + 20;
  const peak = Math.min(sy, ey) - 90;
  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-40 text-xl"
      initial={{ x: sx, y: sy, opacity: 0, rotate: 0 }}
      animate={{ x: [sx, (sx + ex) / 2, ex], y: [sy, peak, ey], opacity: [1, 1, 0], rotate: [0, 200, 400] }}
      transition={{ duration: 1.1, delay: 0.5, ease: 'easeInOut', times: [0, 0.5, 1] }}
      exit={{ opacity: 0 }}
      aria-hidden="true"
    >
      🍬
    </motion.div>
  );
}

function MascotActor({
  slot,
  character,
  role,
  tips,
  partner,
  interaction,
  celebrate,
  announcesOrders,
  onPlace,
  onTalking,
}: {
  slot: 0 | 1;
  character: Character;
  role: Role;
  tips: Tip[];
  partner: (() => Pos | null) | null;
  interaction: Interaction;
  celebrate: { id: number; tipId: string } | null;
  announcesOrders: boolean;
  onPlace: (p: Pos | null) => void;
  onTalking: (v: boolean) => void;
}) {
  const { updateSettings } = useStore();
  const toast = useToast();
  const loc = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const name = characterName(character);

  // messages the user has already read; the badge only counts the unread ones
  const [viewed, setViewed] = useState<Set<string>>(() => new Set(readList(VIEWED_KEY) ?? []));
  const unread = tips.filter((t) => t.level !== 'dica' && !viewed.has(t.id)).length;

  const root = useRef<HTMLDivElement>(null);
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [pos, setPos] = useState<Pos | null>(null); // null = docked at the screen edge
  const [moving, setMoving] = useState<'walk' | 'hop' | null>(null);
  const [duration, setDuration] = useState(0);
  const [facing, setFacing] = useState<1 | -1>(-1);
  const [hidden, setHidden] = useState(false); // fading out during a hop
  const [tipIdx, setTipIdx] = useState<number | null>(null);
  const [hoverBubble, setHoverBubble] = useState(false);
  const [caught, setCaught] = useState(false);
  const busy = useRef(false);
  const minX = desktop ? 264 : 0;

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const h = () => setDesktop(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const moveTo = useCallback(
    (to: Pos | null) => {
      if (busy.current) return;
      const from = pos;
      if (from && to && !reduce && pathClear(from, to, root.current, minX)) {
        const d = Math.hypot(to.x - from.x, to.y - from.y);
        const secs = Math.min(4, Math.max(0.4, d / 140));
        busy.current = true;
        setFacing(to.x >= from.x ? 1 : -1);
        setDuration(secs);
        setMoving('walk');
        setPos(to);
        setTimeout(() => {
          setMoving(null);
          busy.current = false;
        }, secs * 1000);
      } else {
        // path crosses content (or reduced motion): vanish and reappear instead of walking over it
        busy.current = true;
        setMoving('hop');
        setHidden(true);
        setTimeout(() => {
          setDuration(0);
          setPos(to);
          setTimeout(() => {
            setHidden(false);
            setMoving(null);
            busy.current = false;
          }, 40);
        }, 220);
      }
    },
    [pos, reduce, minX],
  );

  const playing = !!interaction || !!celebrate;

  // keep the current spot free: re-check periodically, after scroll/resize and on page change
  useEffect(() => {
    if (!desktop) return;
    let timer: number;
    const check = () => {
      if (busy.current || tipIdx !== null || playing) return;
      if (pos && isFreeRect(pos, makeProbe(root.current), minX)) return;
      // the second mascot starts looking a bit to the left of the first one
      const anchor = pos ?? { x: vwNow() - W - 24 - slot * 140, y: vhNow() - H - 24 };
      const spot = findSpot(anchor, root.current, minX);
      if (!spot && !pos) return; // nowhere free and already docked: stay put
      moveTo(spot);
    };
    const soon = () => {
      clearTimeout(timer);
      timer = window.setTimeout(check, 250 + slot * 400);
    };
    const iv = window.setInterval(check, 1500 + slot * 300);
    window.addEventListener('scroll', soon, true);
    window.addEventListener('resize', soon);
    soon();
    return () => {
      clearInterval(iv);
      clearTimeout(timer);
      window.removeEventListener('scroll', soon, true);
      window.removeEventListener('resize', soon);
    };
  }, [desktop, pos, minX, moveTo, tipIdx, loc.pathname, slot, playing]);

  // idle wandering to another free spot nearby
  useEffect(() => {
    if (!desktop || reduce) return;
    const iv = window.setInterval(() => {
      if (busy.current || tipIdx !== null || playing || !pos || document.hidden) return;
      const target = { x: pos.x + (Math.random() - 0.5) * 500, y: pos.y + (Math.random() - 0.5) * 300 };
      const spot = findSpot(target, root.current, minX, 160);
      if (spot && Math.hypot(spot.x - pos.x, spot.y - pos.y) > 60 && pathClear(pos, spot, root.current, minX)) moveTo(spot);
    }, 16000 + Math.random() * 10000);
    return () => clearInterval(iv);
  }, [desktop, reduce, pos, minX, moveTo, tipIdx, playing]);

  // announce new alerts once a day (new orders are announced by the celebration instead)
  useEffect(() => {
    const seen = readSeen();
    const i = tips.findIndex((t) => t.level !== 'dica' && !t.id.startsWith('new-') && !seen.has(t.id));
    if (i < 0) return;
    seen.add(tips[i].id);
    writeSeen(seen);
    const t = window.setTimeout(() => setTipIdx(i), 900 + slot * 1500);
    return () => clearTimeout(t);
  }, [tips, slot]);

  // new order: the orders mascot tells about it after the celebration jump
  useEffect(() => {
    if (!celebrate || !announcesOrders) return;
    const t = window.setTimeout(() => {
      const i = tips.findIndex((x) => x.id === celebrate.tipId);
      if (i >= 0) setTipIdx(i);
    }, 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate?.id, announcesOrders]);

  // receiving a treat: little happy jump when it lands
  useEffect(() => {
    if (interaction?.kind !== 'doce' || interaction.from === slot) return;
    const a = window.setTimeout(() => setCaught(true), 1500);
    const b = window.setTimeout(() => setCaught(false), 3000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [interaction, slot]);

  // auto-close the bubble unless the user is reading it
  useEffect(() => {
    if (tipIdx === null || hoverBubble) return;
    const t = window.setTimeout(() => setTipIdx(null), 12000);
    return () => clearTimeout(t);
  }, [tipIdx, hoverBubble]);

  useEffect(() => setTipIdx(null), [loc.pathname]);

  const tip: Tip | undefined = tipIdx !== null && tips.length ? tips[tipIdx % tips.length] : undefined;

  // showing a message marks it as read (shared with the other mascot through storage)
  useEffect(() => {
    if (!tip || viewed.has(tip.id)) return;
    const next = new Set([...(readList(VIEWED_KEY) ?? []), ...viewed, tip.id]);
    setViewed(next);
    writeList(VIEWED_KEY, [...next]);
  }, [tip, viewed]);

  useEffect(() => {
    onTalking(!!tip);
  }, [tip, onTalking]);

  const celebrating = !!celebrate || caught;
  const dancing = interaction?.kind === 'danca';
  const waving = !!tip || interaction?.kind === 'aceno' || (interaction?.kind === 'doce' && interaction.from === slot);
  const mood: Mood = celebrating || dancing ? 'animado' : tip ? 'falando' : tips.some((t) => t.level === 'alerta' && !viewed.has(t.id)) ? 'preocupado' : 'feliz';
  const showing = !!tip || celebrating || dancing;

  const docked = !pos;
  const vw = vwNow();
  const vh = vhNow();
  // docked: only ~26px peek out of the right edge (inside the page's empty side margin); the second one docks higher
  const DOCK_SCALE = 0.85;
  const dockY = vh - H - (desktop ? 24 : 84) - slot * (H + 48); // room for the "pedido novo" sign between them
  const place = pos ?? { x: showing ? vw - W - 12 : vw - 26 - (W * (1 - DOCK_SCALE)) / 2, y: dockY };
  const bubbleLeft = place.x > vw / 2;

  useEffect(() => {
    onPlace(place);
  }, [place.x, place.y]); // eslint-disable-line react-hooks/exhaustive-deps

  // face the partner while playing together
  const other = partner?.();
  const face: 1 | -1 = (interaction || celebrate) && other ? (other.x >= place.x ? 1 : -1) : facing;
  const flip = celebrate && announcesOrders ? 1 : face; // the sign text must never be mirrored

  return (
    <div ref={root} aria-live="polite">
      <motion.div
        className="fixed left-0 top-0 z-40"
        initial={false}
        animate={{ x: place.x, y: place.y, opacity: hidden ? 0 : 1, scale: hidden ? 0.5 : docked ? DOCK_SCALE : 1, rotate: docked && !showing ? -14 : 0 }}
        transition={{
          x: moving === 'walk' ? { duration, ease: 'linear' } : docked ? { type: 'spring', stiffness: 260, damping: 26 } : { duration: 0 },
          y: { duration: moving === 'walk' ? duration : 0, ease: 'linear' },
          opacity: { duration: 0.2 },
          scale: { type: 'spring', stiffness: 400, damping: 22 },
        }}
      >
        <motion.button
          type="button"
          onClick={() =>
            setTipIdx((i) => {
              if (i !== null) return null;
              const firstUnread = tips.findIndex((t) => t.level !== 'dica' && !viewed.has(t.id));
              return firstUnread >= 0 ? firstUnread : 0;
            })
          }
          aria-label={unread ? `${name}: ${unread} mensagens não lidas` : name}
          title={`${name}${ROLE_LABEL[role] ? ` (${ROLE_LABEL[role]})` : ''} — clique para ver dicas e avisos`}
          className="relative block cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
          whileHover={reduce ? undefined : { y: -4, rotate: face * 3 }}
          whileTap={{ scale: 0.92 }}
          style={{ scaleX: flip }}
        >
          <MascotSvg
            character={character}
            mood={mood}
            walking={moving === 'walk'}
            waving={waving}
            celebrating={celebrating}
            dancing={dancing}
            sign={celebrate && announcesOrders ? 'Chegou pedido novo, eba! 🎉' : null}
            size={W}
          />
          {unread > 0 && !tip && !celebrating && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{ scaleX: flip }}
              className="absolute -right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-loss px-1 text-[11px] font-bold text-white shadow"
            >
              {unread}
            </motion.span>
          )}
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {tip && (
          <motion.div
            key={tip.id}
            role="dialog"
            aria-label={`Mensagem de ${name}`}
            onMouseEnter={() => setHoverBubble(true)}
            onMouseLeave={() => setHoverBubble(false)}
            initial={{ opacity: 0, scale: 0.9, x: bubbleLeft ? 12 : -12 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="fixed z-40 w-[290px] rounded-2xl border border-line bg-surface p-3.5 text-sm shadow-pop"
            style={{
              left: bubbleLeft ? Math.max(8, place.x - 298) : Math.min(vw - 298, place.x + W + 8),
              top: Math.min(Math.max(8, place.y - 24), vh - 210),
              transformOrigin: bubbleLeft ? 'right bottom' : 'left bottom',
            }}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className={cx('h-2 w-2 rounded-full', tip.level === 'alerta' ? 'bg-loss' : tip.level === 'aviso' ? 'bg-warn' : 'bg-lilac')} />
              <span className="text-xs font-semibold text-pink">{name}</span>
              <span className="text-[11px] text-muted">
                {tip.level}
                {ROLE_LABEL[role] && ` · ${ROLE_LABEL[role]}`}
              </span>
              <button type="button" onClick={() => setTipIdx(null)} className="ml-auto rounded p-0.5 text-muted hover:bg-subtle hover:text-ink" aria-label="Fechar">
                <X size={14} />
              </button>
            </div>
            <p className="leading-relaxed text-ink">{tip.text}</p>
            <div className="mt-3 flex items-center gap-2">
              {tip.action && (
                <button
                  type="button"
                  onClick={() => {
                    setTipIdx(null);
                    navigate(tip.action!.to);
                  }}
                  className="h-8 rounded-lg bg-pink px-3 text-[13px] font-medium text-white hover:bg-pink/90"
                >
                  {tip.action.label}
                </button>
              )}
              {tips.length > 1 && (
                <button type="button" onClick={() => setTipIdx((i) => ((i ?? 0) + 1) % tips.length)} className="inline-flex h-8 items-center gap-0.5 rounded-lg px-2 text-[13px] font-medium text-muted hover:bg-subtle hover:text-ink">
                  Próxima <ChevronRight size={14} />
                </button>
              )}
              <span className="ml-auto text-[11px] tabular text-muted">
                {(tipIdx! % tips.length) + 1}/{tips.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setTipIdx(null);
                updateSettings({ mascotEnabled: false });
                toast('Os mascotes foram descansar. Dá para chamar de volta em Configurações.', 'info');
              }}
              className="mt-2 text-[11px] text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Desativar mascotes
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
