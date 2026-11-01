import { useEffect, useRef } from 'react';
import { easeOut, motion, useReducedMotion, useInView, useScroll, useTransform, type MotionValue } from 'motion/react';

const IMG = {
  choc: '/loja/chocolate.jpg',
  brownie: '/loja/brownie.jpg',
  cakeTop: '/loja/bolo-girando.jpg',
  turn: '/loja/bolo-girando.mp4',
  turnPoster: '/loja/bolo-girando.jpg',
};

/** Story steps; `at` is the slice of the section's scroll progress where the caption shows. */
const STEPS = [
  { t: 'Tudo começa no chocolate', d: 'Chocolate de verdade, derretido devagar até ganhar esse brilho.', at: [0, 0.45] },
  { t: 'Massa batida, forno no ponto', d: 'Casquinha por fora, molhadinho por dentro. Escolha o seu no cardápio.', at: [0.5, 1] },
] as const;

/** Ground of the story: the cool charcoal behind the chocolate photo. */
const STAGE = 'bg-[#1c1e1f]';

type Range = readonly [number, number];

function Caption({ p, i, total }: { p: MotionValue<number>; i: number; total: number }) {
  const s = STEPS[i];
  const [a, b] = s.at as Range;
  const f = Math.min(0.06, (b - a) / 4);
  const first = i === 0;
  const last = i === total - 1;
  const opacity = useTransform(p, [a, a + f, b - f, b], [first ? 1 : 0, 1, 1, last ? 1 : 0]);
  const y = useTransform(p, [a, a + f, b - f, b], [first ? 0 : 40, 0, 0, last ? 0 : -40]);
  const blur = useTransform(p, [a, a + f, b - f, b], [first ? 0 : 8, 0, 0, last ? 0 : 8]);
  const filter = useTransform(blur, (v) => `blur(${v}px)`);
  const visibility = useTransform(opacity, (v) => (v < 0.02 ? 'hidden' : 'visible'));
  return (
    <motion.div style={{ opacity, y, filter, visibility }} className="[grid-area:1/1]">
      <h2 className="font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-white [text-wrap:balance] sm:text-5xl lg:text-6xl">{s.t}</h2>
      <p className="mt-4 max-w-sm text-base text-white sm:text-lg">{s.d}</p>
      {last && (
        <a href="#cardapio" className="mt-7 inline-flex min-h-[52px] items-center rounded-full bg-[#F6F1EA] px-7 text-base font-semibold text-[#2a1810] transition-transform duration-150 ease-out active:scale-[0.97]">
          Ver cardápio
        </a>
      )}
    </motion.div>
  );
}

/** Static version for people who prefer reduced motion: the same story, no scroll effects. */
function StillStory() {
  const pics = [IMG.choc, IMG.brownie];
  return (
    <section aria-label="Como nossos doces são feitos" className={`${STAGE} py-20 text-white`}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <figure key={s.t}>
            <div className="relative aspect-[4/5] overflow-hidden">
              <img src={pics[i]} alt="" loading="lazy" className={`absolute left-0 top-0 w-full object-cover ${i === 0 ? 'h-[114%] object-[50%_40%]' : 'h-full'}`} />
            </div>
            <figcaption className="pt-6">
              <h2 className="font-display text-3xl font-extrabold">{s.t}</h2>
              <p className="mt-2">{s.d}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/** Scroll-driven story: melted chocolate opens up in a circle, then the brownie wipes in over it. */
export default function CakeStory() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  // 1. chocolate: a circle that opens, zoom out and focus
  const chocClip = useTransform(p, [0, 0.28], ['circle(16% at 50% 50%)', 'circle(75% at 50% 50%)'], { ease: easeOut });
  const chocScale = useTransform(p, [0, 0.4], [1.4, 1]);
  const chocBlur = useTransform(p, [0, 0.22], ['blur(8px)', 'blur(0px)']);
  const chocOpacity = useTransform(p, [0.64, 0.66], [1, 0]);
  // 2. brownie: wipes up from the bottom and settles
  const brClip = useTransform(p, [0.45, 0.65], ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'], { ease: easeOut });
  const brScale = useTransform(p, [0.45, 0.95], [1.25, 1]);
  const bar = useTransform(p, [0, 1], [0, 1]);

  if (reduce) return <StillStory />;

  return (
    <section ref={ref} aria-label="Como nossos doces são feitos" className={`relative h-[240svh] ${STAGE}`}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* brownie */}
        <motion.div className="absolute inset-0 overflow-hidden" style={{ clipPath: brClip }}>
          <motion.img
            src={IMG.brownie}
            alt="Brownies empilhados com calda de chocolate e morangos"
            className="absolute inset-0 h-full w-full object-cover object-[50%_45%]"
            style={{ scale: brScale }}
          />
        </motion.div>

        {/* chocolate (the photo is 14% taller than the frame so its bottom edge, with a watermark, never shows) */}
        <motion.div className="absolute inset-0 overflow-hidden" style={{ clipPath: chocClip, opacity: chocOpacity }}>
          <motion.img
            src={IMG.choc}
            alt="Colher derramando chocolate derretido"
            className="absolute left-0 top-0 h-[114%] w-full object-cover object-[50%_40%]"
            style={{ scale: chocScale, filter: chocBlur, transformOrigin: '50% 35%' }}
          />
        </motion.div>

        {/* legibility scrim over the photos, behind the captions (the one gradient the house rules allow) */}
        <div className={/* taste-skill-ignore */ "pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 via-black/50 to-transparent md:inset-y-0 md:left-0 md:right-auto md:h-auto md:w-[60%] md:bg-gradient-to-r md:from-black/75 md:via-black/35"} />

        <div className="absolute inset-x-5 bottom-14 grid items-end md:inset-x-auto md:bottom-0 md:left-[max(1rem,calc((100vw-72rem)/2+1rem))] md:top-0 md:w-[min(36rem,58vw)] md:items-center">
          {STEPS.map((s, i) => (
            <Caption key={s.t} p={p} i={i} total={STEPS.length} />
          ))}
        </div>

        {/* progress */}
        <div className="absolute inset-x-5 bottom-6 h-1 overflow-hidden rounded-full bg-white/15 md:inset-x-auto md:bottom-10 md:left-[max(1rem,calc((100vw-72rem)/2+1rem))] md:w-48">
          <motion.div style={{ scaleX: bar }} className="h-full origin-left rounded-full bg-[#F6F1EA]" />
        </div>
      </div>
    </section>
  );
}

function Word({ p, range, children }: { p: MotionValue<number>; range: Range; children: string }) {
  const opacity = useTransform(p, range as unknown as number[], [0.15, 1]);
  return <motion.span style={{ opacity }}>{children} </motion.span>;
}

/** "About us" block: a short statement that lights up word by word, beside two close-ups. */
export function AboutBakery({ text, body }: { text: string; body: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 50%'] });
  const words = text.split(/\s+/).filter(Boolean);
  const facts = ['Feito sob encomenda', 'Ingredientes de verdade', 'Montado à mão, um a um'];
  return (
    <section id="sobre" className="mx-auto grid max-w-6xl scroll-mt-24 items-center gap-12 px-4 py-28 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-40">
      <div>
        <h2 className="font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.03em] sm:text-6xl">Tudo começa do zero</h2>
        <p ref={ref} className="mt-6 font-display text-2xl font-bold leading-[1.25] tracking-tight [text-wrap:pretty] sm:text-[2rem]">
          {reduce
            ? text
            : words.map((w, i) => (
                <Word key={i} p={scrollYProgress} range={[i / words.length, Math.min(1, (i + 2) / words.length)]}>
                  {w}
                </Word>
              ))}
        </p>
        <p className="mt-6 max-w-[60ch] text-lg">{body}</p>
        <ul className="mt-8 flex flex-wrap gap-3">
          {facts.map((f, i) => (
            <motion.li
              key={f}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="rounded-full bg-subtle px-4 py-2 text-base font-semibold"
            >
              {f}
            </motion.li>
          ))}
        </ul>
      </div>
      {/* close-ups cropped from the bakery's own photos */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[
          { src: IMG.choc, pos: '52% 22%', alt: 'Chocolate derretido escorrendo da colher', cls: 'row-span-2 aspect-[3/5]' },
          { src: IMG.brownie, pos: '62% 18%', alt: 'Morangos frescos sobre o brownie', cls: 'aspect-square' },
          { src: IMG.cakeTop, pos: '92% 92%', alt: 'Barras de chocolate ao lado do bolo', cls: 'aspect-square' },
        ].map((ph, i) => (
          <motion.div
            key={ph.alt}
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ delay: i * 0.08, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
            className={`relative overflow-hidden ${ph.cls}`}
          >
            <div role="img" aria-label={ph.alt} className="absolute inset-0 bg-no-repeat" style={{ backgroundImage: `url(${ph.src})`, backgroundSize: '170%', backgroundPosition: ph.pos }} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/**
 * The real cake turning on its stand (a short clip made from the bakery's photo, played forwards
 * then backwards so the loop never jumps). It only plays while on screen; with reduced motion
 * the poster frame stays still.
 */
export function CakeTurntable() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const inView = useInView(ref, { margin: '0px 0px -10% 0px' });
  const seen = useRef(false);
  useEffect(() => {
    const v = ref.current;
    if (!v || reduce) return;
    // autoplay starts it; pause only once it has actually been seen and then scrolled away
    if (inView) {
      seen.current = true;
      v.play().catch(() => {});
    } else if (seen.current) v.pause();
  }, [inView, reduce]);
  return (
    // the clip's own backdrop matches the hero ground, so its edges are feathered into it (taste-skill-ignore)
    <div className={/* taste-skill-ignore */ "absolute inset-0 overflow-hidden [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_76%,transparent_100%)]"}>
      {reduce ? (
        <img src={IMG.turnPoster} alt="Bolo de chocolate com ganache e frutas vermelhas no suporte dourado" className="h-full w-full object-cover object-[50%_55%]" />
      ) : (
        <video
          ref={ref}
          src={IMG.turn}
          poster={IMG.turnPoster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label="Bolo de chocolate com ganache e frutas vermelhas girando no suporte dourado"
          className="h-full w-full object-cover object-[50%_55%]"
        />
      )}
    </div>
  );
}
