import { useEffect, useId } from 'react';
import { Check, Palette } from 'lucide-react';
import { ACCENT_PRESETS, DEFAULT_ACCENT, applyAccent, resolveAccent } from '../lib/theme';
import { cx } from './ui';

/** Keeps the page's accent variables in sync with the chosen color. */
export function AccentStyle({ choice }: { choice: string | undefined }) {
  useEffect(() => applyAccent(choice), [choice]);
  return null;
}

/**
 * Swatches for the ready palettes plus a free color. `inherit` adds an "Igual ao sistema" option
 * (used by the store, which follows the admin color until it gets its own).
 */
export function AccentPicker({
  value,
  onChange,
  inherit,
  label,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  inherit?: { label: string; color: string | undefined };
  label: string;
}) {
  const id = useId();
  const isCustom = !!value && value.startsWith('#');
  const current = resolveAccent(value ?? inherit?.color);
  const selected = value ?? (inherit ? undefined : DEFAULT_ACCENT);

  const swatch = (key: string, title: string, primary: string, secondary: string, active: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      title={title}
      className="group flex w-16 flex-col items-center gap-1.5 rounded-lg p-1 text-[11px] text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
    >
      <span
        className={cx(
          'relative grid h-10 w-10 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-[box-shadow,transform] duration-150 ease-out group-active:scale-[0.94]',
          active ? 'ring-2 ring-ink/70' : 'ring-1 ring-line group-hover:ring-ink/30',
        )}
        style={{ background: `linear-gradient(135deg, ${primary} 0 50%, ${secondary} 50% 100%)` }}
      >
        {active && <Check size={16} className="text-white drop-shadow" strokeWidth={3} />}
      </span>
      <span className={cx('truncate', active && 'font-medium text-ink')}>{title}</span>
    </button>
  );

  return (
    <div>
      <div className="mb-2 text-sm font-medium" id={`${id}-label`}>
        {label}
      </div>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-1">
        {inherit &&
          (() => {
            const c = resolveAccent(inherit.color);
            return swatch('inherit', inherit.label, c.primary, c.secondary, selected === undefined, () => onChange(undefined));
          })()}
        {ACCENT_PRESETS.map((p) => swatch(p.id, p.label, p.primary, p.secondary, selected === p.id, () => onChange(p.id)))}
        <label
          className="group flex w-16 cursor-pointer flex-col items-center gap-1.5 rounded-lg p-1 text-[11px] text-muted focus-within:ring-2 focus-within:ring-pink/40"
          title="Escolher qualquer cor"
        >
          <span
            className={cx(
              'relative grid h-10 w-10 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-[box-shadow] duration-150',
              isCustom ? 'ring-2 ring-ink/70' : 'ring-1 ring-line group-hover:ring-ink/30',
            )}
            style={{ background: isCustom ? current.primary : 'conic-gradient(from 90deg, #DB2777, #F59E0B, #10B981, #0EA5E9, #8B5CF6, #DB2777)' }}
          >
            {isCustom ? <Check size={16} className="text-white drop-shadow" strokeWidth={3} /> : <Palette size={16} className="text-white drop-shadow" />}
            <input
              type="color"
              value={isCustom ? value : current.primary.toLowerCase()}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label={`${label}: cor personalizada`}
            />
          </span>
          <span className={cx('truncate', isCustom && 'font-medium text-ink')}>Outra cor</span>
        </label>
      </div>
      {isCustom && resolveAccent(value).adjusted && (
        <p className="mt-2 text-xs text-muted">Escurecemos um pouco essa cor para o texto dos botões continuar legível.</p>
      )}
    </div>
  );
}

/** Small mock of buttons, a badge and a highlight in the given color, for the store preview. */
export function AccentPreview({ choice, title }: { choice: string | undefined; title: string }) {
  const { primary, secondary } = resolveAccent(choice);
  return (
    <div className="rounded-xl border border-line bg-bg p-3" aria-hidden="true">
      <div className="mb-2 text-[11px] font-medium text-muted">{title}</div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium text-white" style={{ background: primary }}>
          Encomendar
        </span>
        <span className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-semibold text-white" style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }}>
          Ver cardápio
        </span>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: primary, background: `${primary}1F` }}>
          novidade
        </span>
        <span className="text-sm font-semibold tabular" style={{ color: primary }}>
          R$ 89,90
        </span>
      </div>
    </div>
  );
}
