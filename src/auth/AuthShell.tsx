import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { cloudConfigured } from '../lib/supabase';
import { cx } from '../components/ui';
import { DashboardPreview } from './DashboardPreview';
import { BrandLogo, BrandMark } from '../components/BrandMark';

const SLIDES = [
  { src: '/auth/bolo.jpg', pos: '50% 45%', title: 'Cada fatia com o preço certo.', text: 'Ingredientes, gás, embalagem e a sua hora de trabalho entram na conta.' },
  { src: '/auth/brownie.jpg', pos: '50% 40%', title: 'Do orçamento à entrega.', text: 'Veja o que sai hoje, o que está no forno e o que falta receber.' },
  // anchored to the top so the bottom edge of the photo stays out of frame
  { src: '/auth/chocolate.jpg', pos: '50% 0%', title: 'Sua confeitaria em qualquer aparelho.', text: 'Tudo salvo na nuvem — no computador da cozinha ou no celular.' },
];
const SLIDE_MS = 6500;
const ease = [0.23, 1, 0.32, 1] as const;

/** Photos crossfade with a slow push-in; the caption and progress bars follow the photo. */
function PhotoStory({ compact }: { compact?: boolean }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  // the photo leans a little toward the pointer (desktop only), springing so it never feels glued to the mouse
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const tx = useTransform(sx, (v) => `${v * -14}px`);
  const ty = useTransform(sy, (v) => `${v * -10}px`);

  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % SLIDES.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [reduce]);

  // preload the next photos so the crossfade never shows an empty frame
  useEffect(() => {
    SLIDES.forEach((s) => {
      const img = new Image();
      img.src = s.src;
    });
  }, []);

  const s = SLIDES[i];
  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#1c1210]"
      onPointerMove={(e) => {
        if (compact || e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <motion.div className="absolute -inset-6" style={{ x: tx, y: ty }}>
        <AnimatePresence initial={false}>
          <motion.img
            key={s.src}
            src={s.src}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover"
            style={{ objectPosition: s.pos }}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1.0, transition: { opacity: { duration: 1.1, ease: 'easeOut' }, scale: { duration: SLIDE_MS / 1000 + 1.2, ease: 'linear' } } }}
            exit={{ opacity: 0, transition: { duration: 1.1, ease: 'easeOut' } }}
          />
        </AnimatePresence>
      </motion.div>
      {/* scrim so white text stays readable on any photo */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/30" />

      {/* the system itself, working, floating over the photo (wide screens only: it needs room) */}
      {!compact && (
        <div className="hidden xl:block">
          <DashboardPreview index={i} px={sx} py={sy} />
        </div>
      )}

      <div className={compact ? 'absolute left-5 top-5' : 'absolute left-10 top-10'}>
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay: 0.1 }} className="flex items-center gap-2.5 text-white">
          <BrandMark size={compact ? 40 : 46} className="shadow-lg ring-white/40" />
          <span className="font-display text-xl font-extrabold">CakeBoss</span>
        </motion.div>
      </div>

      {/* on a phone the form sheet overlaps the photo's bottom 24px, so the caption sits above it */}
      <div className={compact ? 'absolute inset-x-5 bottom-11' : 'absolute inset-x-10 bottom-10 max-w-lg'}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)', transition: { duration: 0.25 } }}
            transition={{ duration: 0.6, ease }}
          >
            <p className={compact ? 'font-display text-2xl font-extrabold leading-tight text-white' : 'font-display text-[52px] font-extrabold leading-[1.02] text-white'}>{s.title}</p>
            {!compact && <p className="mt-3 max-w-md text-base leading-relaxed text-white/80">{s.text}</p>}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Frame shared by every account page: the photo story stays put while the form beside it changes,
 * so moving between "Entrar" and "Criar conta" feels like one place.
 */
export function AuthShell() {
  const outlet = useOutlet();
  const loc = useLocation();
  // on a wide screen the photo and the form trade sides between "Entrar" and "Criar conta"
  const flipped = loc.pathname === '/criar-conta';
  const swap = { layout: { duration: 0.75, ease: [0.77, 0, 0.175, 1] as const } };
  return (
    <div className={cx('min-h-screen bg-bg lg:flex', flipped && 'lg:flex-row-reverse')}>
      <motion.div layout transition={swap} className="h-[34vh] min-h-[220px] lg:sticky lg:top-0 lg:h-screen lg:w-[52%] lg:shrink-0">
        <div className="h-full lg:hidden">
          <PhotoStory compact />
        </div>
        <div className="hidden h-full lg:block">
          <PhotoStory />
        </div>
      </motion.div>
      <motion.main
        layout
        transition={swap}
        className="relative -mt-6 flex flex-1 justify-center rounded-t-[28px] bg-bg px-5 pb-12 pt-9 sm:px-8 lg:mt-0 lg:items-center lg:rounded-none lg:py-12"
      >
        <div className="w-full max-w-[420px]">
          {/* full logo with its wordmark, centred over the form on every account page */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', duration: 0.8, bounce: 0.25 }}
            className="mb-6 flex justify-center"
          >
            <BrandLogo className="h-28 w-auto drop-shadow-[0_10px_18px_rgb(60_30_10/0.18)] lg:h-36" />
          </motion.div>
          {!cloudConfigured && (
            <p role="alert" className="mb-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-ink">
              A conexão com o servidor não está configurada (falta o arquivo <code>.env.local</code>). Entrar e criar conta não vão funcionar.
            </p>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={loc.pathname}
              initial={{ opacity: 0, x: 16, filter: 'blur(4px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -12, filter: 'blur(3px)', transition: { duration: 0.15 } }}
              transition={{ duration: 0.32, ease }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>
    </div>
  );
}

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease } } };

/** Title, form and footer of one account page; its parts arrive one after another the first time it opens. */
export function AuthForm({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } }}>
      <motion.h1 variants={item} className="text-center text-[34px] font-extrabold leading-[1.05] text-ink">
        {title}
      </motion.h1>
      {subtitle && (
        <motion.p variants={item} className="mt-2 text-balance text-center text-[15px] leading-relaxed text-muted">
          {subtitle}
        </motion.p>
      )}
      <motion.div variants={item} className="mt-8">
        {children}
      </motion.div>
      {footer && (
        <motion.div variants={item} className="mt-8 border-t border-divider pt-6 text-center text-sm text-muted">
          {footer}
        </motion.div>
      )}
    </motion.div>
  );
}
