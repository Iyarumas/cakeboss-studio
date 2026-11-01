import { forwardRef, useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { motion } from 'motion/react';
import { clamp } from '@cakeboss/domain/format';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' }) {
  return <As className={cx('rounded-card border border-line bg-surface shadow-card', className)}>{children}</As>;
}

export function CardHeader({ title, subtitle, icon, actions, className }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cx('flex flex-wrap items-start justify-between gap-3 border-b border-divider px-5 py-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-pink-soft text-pink">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
// a slight press-in on :active confirms the click was heard
const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 disabled:cursor-not-allowed disabled:opacity-50';
const btnVariant: Record<BtnVariant, string> = {
  primary: 'bg-pink text-white hover:bg-pink/90 shadow-sm',
  secondary: 'border border-line bg-surface text-ink hover:bg-subtle',
  ghost: 'text-muted hover:bg-subtle hover:text-ink',
  danger: 'border border-loss/30 bg-surface text-loss hover:bg-loss-soft',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }>(
  ({ variant = 'secondary', size = 'md', className, type = 'button', ...rest }, ref) => (
    <button ref={ref} type={type} className={cx(btnBase, btnVariant[variant], size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4', className)} {...rest} />
  ),
);

export function IconButton({ label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40', className)}
      {...rest}
    />
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 transition-shadow focus:border-pink/60 focus:outline-none focus:ring-2 focus:ring-pink/20';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...rest }, ref) => (
  <input ref={ref} className={cx(inputCls, className)} {...rest} />
));

/** Number input that keeps the raw text while typing (accepts comma) and commits numbers. */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 'any',
  prefix,
  suffix,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'prefix'> & {
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);
  const commit = (raw: string) => {
    // "1.234,5" (pt-BR) or "1234.5"
    const n = parseFloat(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
    if (!Number.isFinite(n)) return;
    const bounded = clamp(n, typeof min === 'number' ? min : -Infinity, typeof max === 'number' ? max : Infinity);
    onChange(bounded);
  };
  return (
    <div className={cx('relative flex items-center', className)}>
      {prefix && <span className="pointer-events-none absolute left-3 text-sm text-muted">{prefix}</span>}
      <input
        inputMode="decimal"
        className={cx(inputCls, 'tabular', prefix && 'pl-9', suffix && 'pr-10')}
        value={text}
        step={step}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          setText(fmt(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute right-3 text-sm text-muted">{suffix}</span>}
    </div>
  );
}
const fmt = (v: number) => (Number.isFinite(v) ? String(Math.round(v * 10000) / 10000).replace('.', ',') : '');

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputCls, 'appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8', className)} style={{ backgroundImage: chevron }} {...rest}>
      {children}
    </select>
  );
}
const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

const badgeTone = {
  pink: 'bg-pink-soft text-pink',
  green: 'bg-profit-soft text-profit',
  red: 'bg-loss-soft text-loss',
  amber: 'bg-warn-soft text-warn',
  lilac: 'bg-lilac-soft text-lilac',
  gray: 'bg-subtle text-muted border border-line',
};
export function Badge({ tone = 'gray', children, className }: { tone?: keyof typeof badgeTone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', badgeTone[tone], className)}>{children}</span>;
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-pink-soft text-pink">{icon}</span>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Range slider paired with an editable numeric field. Native input keeps touch + keyboard support. */
export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  hint,
  marker,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  hint?: ReactNode;
  marker?: { value: number; label: string };
}) {
  const id = useId();
  const span = max - min || 1;
  const p = clamp((value - min) / span, 0, 1) * 100;
  const mp = marker && Number.isFinite(marker.value) ? clamp((marker.value - min) / span, 0, 1) * 100 : null;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        <NumberInput value={value} onChange={onChange} min={min} prefix={prefix} suffix={suffix} className="w-32" aria-label={typeof label === 'string' ? label : undefined} />
      </div>
      <div className="relative">
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-divider" />
        <motion.div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-lilac to-pink"
          animate={{ width: `${p}%` }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        />
        {mp !== null && (
          <motion.div
            className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded bg-ink/60"
            animate={{ left: `${mp}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            title={marker!.label}
          />
        )}
        <input
          id={id}
          type="range"
          className="dg-range"
          min={min}
          max={max}
          step={step}
          value={clamp(value, min, max)}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
      </div>
      {(hint || marker) && (
        <div className="mt-0.5 flex justify-between gap-2 text-xs text-muted">
          <span>{hint}</span>
          {marker && Number.isFinite(marker.value) && <span>▏{marker.label}</span>}
        </div>
      )}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  const id = useId();
  return (
    <div className="inline-flex rounded-lg border border-line bg-subtle p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('relative h-8 rounded-md px-3 text-[13px] font-medium transition-colors', value === o.value ? 'text-ink' : 'text-muted hover:text-ink')}
        >
          {value === o.value && <motion.span layoutId={id} className="absolute inset-0 rounded-md border border-line bg-surface shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, children, tone, className }: { label: ReactNode; children: ReactNode; tone?: 'green' | 'red' | 'pink'; className?: string }) {
  return (
    <div className={cx('min-w-0', className)}>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={cx('mt-1 truncate text-lg font-semibold tabular', tone === 'green' ? 'text-profit' : tone === 'red' ? 'text-loss' : tone === 'pink' ? 'text-pink' : 'text-ink')}>{children}</div>
    </div>
  );
}
