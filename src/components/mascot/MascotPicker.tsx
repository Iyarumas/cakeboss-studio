import { useState } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../../store/store';
import { Segmented, Select, cx } from '../ui';
import { CHARACTERS, MascotSvg, characterName, type Character } from './MascotSvg';

function CharacterGrid({ value, onPick, disabled, group }: { value: Character | null; onPick: (c: Character) => void; disabled?: Character | null; group: string }) {
  const [preview, setPreview] = useState<Character | null>(null);
  return (
    <div role="radiogroup" aria-label={group} className="grid grid-cols-3 gap-3">
      {CHARACTERS.map((c) => {
        const active = c.id === value;
        const off = c.id === disabled;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={off}
            title={off ? 'Já escolhido como o outro mascote' : undefined}
            onClick={() => onPick(c.id)}
            onMouseEnter={() => setPreview(c.id)}
            onMouseLeave={() => setPreview(null)}
            onFocus={() => setPreview(c.id)}
            onBlur={() => setPreview(null)}
            className={cx(
              'relative flex flex-col items-center rounded-xl border-2 px-2 pb-3 pt-10 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              active ? 'border-pink bg-pink-soft/40' : 'border-line hover:border-pink/40 hover:bg-subtle',
            )}
          >
            <MascotSvg character={c.id} mood={preview === c.id ? 'animado' : 'feliz'} walking={false} waving={false} celebrating={preview === c.id && !off} size={56} />
            <span className="mt-2 text-sm font-semibold">{c.name}</span>
            <span className="mt-0.5 text-[11px] leading-snug text-muted">{c.description}</span>
            {active && (
              <motion.span layoutId={`picked-${group}`} className="absolute right-2 top-2 rounded-full bg-pink px-2 py-0.5 text-[10px] font-semibold text-white">
                escolhido
              </motion.span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Choose one or two helper characters and, with two, who takes care of what. */
export function MascotPicker() {
  const { db, updateSettings } = useStore();
  const first = db.settings.mascotCharacter ?? 'docinho';
  const second = db.settings.mascotSecond ?? null;
  const role = db.settings.mascotFirstRole ?? 'pedidos';
  const other = (c: Character) => CHARACTERS.find((x) => x.id !== c)!.id;

  return (
    <div className="space-y-4 border-t border-divider p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-medium">Quantos mascotes?</div>
        <Segmented
          value={second ? 'dois' : 'um'}
          onChange={(v) => updateSettings({ mascotSecond: v === 'dois' ? other(first) : null }, v === 'dois' ? 'Dois mascotes ativados' : 'Um mascote ativado')}
          options={[
            { value: 'um', label: 'Um' },
            { value: 'dois', label: 'Dois' },
          ]}
        />
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{second ? 'Mascote 1' : 'Mascote'}</div>
        <CharacterGrid group="m1" value={first} disabled={second} onPick={(c) => updateSettings({ mascotCharacter: c }, `Mascote alterado para ${characterName(c)}`)} />
      </div>

      {second && (
        <>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Mascote 2</div>
            <CharacterGrid group="m2" value={second} disabled={first} onPick={(c) => updateSettings({ mascotSecond: c }, `Segundo mascote: ${characterName(c)}`)} />
          </div>
          <div className="rounded-xl border border-line bg-subtle/60 p-4">
            <div className="mb-2 text-sm font-medium">Quem cuida do quê</div>
            <div className="grid items-center gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 font-semibold">{characterName(first)}</span>
                <Select value={role} onChange={(e) => updateSettings({ mascotFirstRole: e.target.value as 'pedidos' | 'financas' })} className="h-9">
                  <option value="pedidos">Pedidos e entregas</option>
                  <option value="financas">Finanças, estoque e preços</option>
                </Select>
              </label>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 font-semibold">{characterName(second)}</span>
                <span className="text-muted">{role === 'pedidos' ? 'Finanças, estoque e preços' : 'Pedidos e entregas'}</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">De vez em quando os dois brincam juntos: dançam, se acenam e jogam docinhos um para o outro. 🍬</p>
          </div>
        </>
      )}
      <p className="text-xs text-muted">Passe o mouse num mascote para ver a comemoração de pedido novo.</p>
    </div>
  );
}
