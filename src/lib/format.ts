import type { Unit } from './types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl4 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const dt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const dtt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const money = (v: number) => (Number.isFinite(v) ? brl.format(v) : '—');
export const moneyFine = (v: number) => (Number.isFinite(v) ? brl4.format(v) : '—');
export const number = (v: number) => (Number.isFinite(v) ? num.format(v) : '—');
export const pct = (v: number, digits = 1) =>
  Number.isFinite(v) ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%` : '—';
export const date = (iso: string) => dt.format(new Date(iso));
export const dateTime = (iso: string) => dtt.format(new Date(iso));

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const nowIso = () => new Date().toISOString();

export const UNIT_LABEL: Record<Unit, string> = { g: 'g', kg: 'kg', ml: 'ml', l: 'L', un: 'un' };

/** Units that share a base (g, ml or un) with the given unit. */
export function compatibleUnits(u: Unit): Unit[] {
  if (u === 'g' || u === 'kg') return ['g', 'kg'];
  if (u === 'ml' || u === 'l') return ['ml', 'l'];
  return ['un'];
}

export const baseUnit = (u: Unit): Unit => (u === 'kg' ? 'g' : u === 'l' ? 'ml' : u);
export const toBase = (qty: number, u: Unit) => (u === 'kg' || u === 'l' ? qty * 1000 : qty);

/** Formats a base-unit quantity with a friendly unit (2500 g → 2,5 kg). */
export function qtyBase(qty: number, u: Unit) {
  const b = baseUnit(u);
  if (b === 'g' && Math.abs(qty) >= 1000) return `${number(qty / 1000)} kg`;
  if (b === 'ml' && Math.abs(qty) >= 1000) return `${number(qty / 1000)} L`;
  return `${number(qty)} ${UNIT_LABEL[b]}`;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const safeNum = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO → value for <input type="datetime-local"> in local time. */
export const toLocalDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** ISO → value for <input type="date"> in local time. */
export const toLocalDate = (iso: string) => toLocalDateTime(iso).slice(0, 10);
/** <input type="date"> value → ISO at local noon (stays on the same day in any timezone shift). */
export const fromLocalDate = (v: string) => new Date(`${v}T12:00:00`).toISOString();
export const fromLocalDateTime = (v: string) => new Date(v).toISOString();
/** "YYYY-MM" of a date in local time. */
export const monthKey = (iso: string) => toLocalDate(iso).slice(0, 7);
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
};
export const isSameLocalDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const relativeDay = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (isSameLocalDay(d, today)) return `Hoje, ${time}`;
  if (isSameLocalDay(d, tomorrow)) return `Amanhã, ${time}`;
  return `${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(d)}, ${time}`;
};
