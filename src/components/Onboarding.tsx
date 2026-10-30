import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useStore } from '../store/store';
import { CHARACTERS, MascotSvg } from './mascot/MascotSvg';
import { Button, Field, TextInput } from './ui';

const CONFETTI = ['#DB2777', '#8B5CF6', '#F59E0B', '#10B981', '#38BDF8', '#F472B6'];

function Confetti() {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 2.4 + Math.random() * 1.8,
        rot: (Math.random() - 0.5) * 720,
        color: CONFETTI[i % CONFETTI.length],
        w: 6 + Math.random() * 6,
        drift: (Math.random() - 0.5) * 160,
      })),
    [],
  );
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block rounded-sm"
          style={{ left: `${p.x}%`, width: p.w, height: p.w * 0.45, background: p.color }}
          initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', x: p.drift, rotate: p.rot, opacity: [1, 1, 0.8] }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'easeIn', repeat: Infinity, repeatDelay: Math.random() }}
        />
      ))}
    </div>
  );
}

/**
 * First access: asks the user's name, then greets them alone on screen with all the mascots
 * celebrating, and only then opens the system. Shown once (settings.onboarded).
 */
export function Onboarding() {
  const { db, updateSettings } = useStore();
  const [step, setStep] = useState<'nome' | 'festa' | 'fim'>('nome');
  const [name, setName] = useState(db.settings.ownerName);
  const [business, setBusiness] = useState(db.settings.businessName === 'Minha Confeitaria' ? '' : db.settings.businessName);
  const first = name.trim().split(/\s+/)[0] ?? '';

  const finish = () => {
    updateSettings({ ownerName: name.trim(), businessName: business.trim() || db.settings.businessName, onboarded: true }, 'Primeiro acesso concluído');
    setStep('fim');
  };

  // the greeting opens the system by itself after a few seconds
  useEffect(() => {
    if (step !== 'festa') return;
    const t = window.setTimeout(finish, 5200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (db.settings.onboarded && step !== 'fim') return null;

  return (
    <AnimatePresence>
      {step !== 'fim' && (
        <motion.div
          key="onb"
          className="fixed inset-0 z-[90] grid place-items-center overflow-hidden bg-gradient-to-br from-pink-soft via-bg to-lilac-soft px-4"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <AnimatePresence mode="wait">
            {step === 'nome' ? (
              <motion.form
                key="nome"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (first) setStep('festa');
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 text-center shadow-pop"
              >
                <div className="-mt-20 mb-2 flex items-end justify-center gap-1">
                  {CHARACTERS.map((c, i) => (
                    <motion.div key={c.id} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 300, damping: 18 }}>
                      <MascotSvg character={c.id} mood="feliz" walking={false} waving={i === 1} size={i === 1 ? 84 : 66} />
                    </motion.div>
                  ))}
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Boas-vindas ao DoceGestão!</h1>
                <p className="mt-1 text-sm text-muted">Antes de começar, como podemos te chamar?</p>
                <div className="mt-6 space-y-4 text-left">
                  <Field label="Seu nome">
                    <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Letícia" />
                  </Field>
                  <Field label="Nome da confeitaria" hint="Opcional — dá para mudar depois em Configurações.">
                    <TextInput value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Ex.: Doces da Lê" />
                  </Field>
                </div>
                <Button type="submit" variant="primary" className="mt-6 w-full" disabled={!first}>
                  Continuar <ArrowRight size={16} />
                </Button>
              </motion.form>
            ) : (
              <motion.div key="festa" className="relative grid h-full w-full place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Confetti />
                <div className="relative text-center">
                  <motion.h1
                    initial={{ opacity: 0, scale: 0.6, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.1 }}
                    className="bg-gradient-to-r from-pink to-lilac bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-7xl"
                  >
                    Olá, {first}!
                  </motion.h1>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-3 text-base text-muted sm:text-lg">
                    Que bom ter você aqui. Vamos adoçar a gestão? 🧁
                  </motion.p>
                  <div className="mt-28 flex items-end justify-center gap-4 sm:gap-10">
                    {CHARACTERS.map((c, i) => (
                      <motion.div key={c.id} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 + i * 0.15, type: 'spring', stiffness: 260, damping: 16 }}>
                        <MascotSvg character={c.id} mood="animado" walking={false} waving={false} celebrating sign={i === 1 ? `Oi, ${first}! 🎉` : null} size={i === 1 ? 110 : 88} />
                      </motion.div>
                    ))}
                  </div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="mt-10">
                    <Button variant="primary" onClick={finish}>
                      Começar <ArrowRight size={16} />
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
