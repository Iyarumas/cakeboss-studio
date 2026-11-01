import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export type Mood = 'feliz' | 'preocupado' | 'falando' | 'animado';
export type Character = 'docinho' | 'brigadinho' | 'mila';

export const CHARACTERS: { id: Character; name: string; description: string }[] = [
  { id: 'docinho', name: 'Docinho', description: 'Cupcake de morango, animado e falante' },
  { id: 'brigadinho', name: 'Brigadinho', description: 'Brigadeiro com granulado colorido, calmo e caprichoso' },
  { id: 'mila', name: 'Mila', description: 'Macaron de lavanda e menta, organizada e atenta' },
];

export const characterName = (c: Character | undefined) => CHARACTERS.find((x) => x.id === c)?.name ?? 'Docinho';

const INK = '#1F1235';

/** Per-character body. Each one reports where its face and shoulders are so the shared rig fits. */
const BODIES: Record<Character, { face: { y: number; light?: boolean }; shoulders: [number, number, number, number]; body: ReactNode }> = {
  docinho: {
    face: { y: 61 },
    shoulders: [18, 62, 62, 60],
    body: (
      <>
        <path d="M14 48 L66 48 L59 82 Q40 85 21 82 Z" fill="#A78BFA" />
        <path d="M22 50 L25 81 M32 50 L33 83 M42 50 L41 83 M52 50 L49 82 M60 50 L56 81" stroke="#fff" strokeWidth="2.2" opacity="0.35" />
        <ellipse cx="40" cy="46" rx="29" ry="11" fill="#F9A8D4" />
        <ellipse cx="40" cy="36" rx="22" ry="10" fill="#F472B6" />
        <ellipse cx="40" cy="27" rx="14" ry="8" fill="#EC4899" />
        <path d="M44 14 Q47 6 53 4" stroke="#15803D" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="44" cy="16" r="5.5" fill="#DC2626" />
        <circle cx="42.3" cy="14.2" r="1.6" fill="#fff" opacity="0.8" />
        <Sprinkles items={[[24, 44, 20, '#FDE047'], [33, 49, -30, '#fff'], [50, 43, 40, '#67E8F9'], [58, 47, -15, '#FDE047'], [30, 35, 60, '#67E8F9'], [47, 33, -50, '#fff']]} />
      </>
    ),
  },
  brigadinho: {
    face: { y: 47, light: true },
    shoulders: [15, 56, 65, 56],
    body: (
      <>
        {/* pleated paper cup */}
        <path d="M17 64 L63 64 L58 83 Q40 86 22 83 Z" fill="#DB2777" />
        <path d="M21 65 L24 83 M28 65 L30 84 M35 65 L36 85 M42 65 L42 85 M49 65 L48 84 M56 65 L54 83" stroke="#fff" strokeWidth="1.6" opacity="0.4" />
        <circle cx="40" cy="47" r="27" fill="#5B3A29" />
        <ellipse cx="31" cy="35" rx="9" ry="5" fill="#fff" opacity="0.12" />
        <Sprinkles
          items={[[24, 30, 30, '#F472B6'], [38, 23, -20, '#FDE047'], [52, 28, 50, '#67E8F9'], [58, 40, -40, '#F472B6'], [20, 44, 70, '#86EFAC'], [28, 58, -10, '#FDE047'], [53, 58, 25, '#86EFAC'], [45, 33, 80, '#fff'], [33, 31, -60, '#67E8F9'], [62, 50, 15, '#FDE047']]}
        />
      </>
    ),
  },
  mila: {
    face: { y: 34 },
    shoulders: [11, 52, 69, 52],
    body: (
      <>
        {/* bottom shell, cream, top shell */}
        <rect x="10" y="56" width="60" height="24" rx="12" fill="#6EE7B7" />
        <path d="M12 60 Q16 56 20 60 Q24 56 28 60 Q32 56 36 60 Q40 56 44 60 Q48 56 52 60 Q56 56 60 60 Q64 56 68 60" stroke="#34D399" strokeWidth="2.5" fill="none" />
        <rect x="13" y="47" width="54" height="11" rx="5.5" fill="#FFF7ED" />
        <rect x="9" y="14" width="62" height="36" rx="18" fill="#C4B5FD" />
        <path d="M11 46 Q15 50 19 46 Q23 50 27 46 Q31 50 35 46 Q39 50 43 46 Q47 50 51 46 Q55 50 59 46 Q63 50 69 46" stroke="#A78BFA" strokeWidth="2.5" fill="none" />
        <ellipse cx="28" cy="21" rx="10" ry="3.5" fill="#fff" opacity="0.35" />
        <circle cx="55" cy="13" r="4" fill="#F9A8D4" />
        <circle cx="61" cy="14" r="4" fill="#F9A8D4" />
        <circle cx="58" cy="15" r="2" fill="#EC4899" />
      </>
    ),
  },
};

function Sprinkles({ items }: { items: (number | string)[][] }) {
  return (
    <>
      {items.map(([x, y, r, c], i) => (
        <rect key={i} x={x as number} y={y as number} width="5" height="1.8" rx="0.9" fill={c as string} transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </>
  );
}

function Face({ y, light, mood, reduce }: { y: number; light?: boolean; mood: Mood; reduce: boolean | null }) {
  const eye = light ? '#fff' : INK;
  const pupil = light ? INK : '#fff';
  return (
    <>
      <ellipse cx="27" cy={y + 7} rx="4" ry="2.4" fill="#F472B6" opacity="0.55" />
      <ellipse cx="53" cy={y + 7} rx="4" ry="2.4" fill="#F472B6" opacity="0.55" />
      {mood === 'animado' ? (
        // happy closed eyes ^ ^
        <>
          <path d={`M29.5 ${y + 1} Q33 ${y - 3.5} 36.5 ${y + 1}`} stroke={eye} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <path d={`M43.5 ${y + 1} Q47 ${y - 3.5} 50.5 ${y + 1}`} stroke={eye} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <motion.g animate={reduce ? undefined : { scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 4, times: [0, 0.92, 0.96, 1], repeat: Infinity }} style={{ originY: `${y}px` }}>
          <circle cx="33" cy={y} r="3.4" fill={eye} />
          <circle cx="47" cy={y} r="3.4" fill={eye} />
          <circle cx="34.2" cy={y - 1.2} r="1.1" fill={pupil} />
          <circle cx="48.2" cy={y - 1.2} r="1.1" fill={pupil} />
        </motion.g>
      )}
      {mood === 'preocupado' ? (
        <>
          <path d={`M29 ${y - 6} L36 ${y - 4.5}`} stroke={eye} strokeWidth="1.6" strokeLinecap="round" />
          <path d={`M51 ${y - 6} L44 ${y - 4.5}`} stroke={eye} strokeWidth="1.6" strokeLinecap="round" />
          <ellipse cx="40" cy={y + 9} rx="2.6" ry="3" fill={eye} />
        </>
      ) : mood === 'falando' ? (
        <motion.ellipse cx="40" cy={y + 8.5} rx="4" fill="#9D174D" animate={reduce ? { ry: 2.5 } : { ry: [1.5, 3.2, 1.5] }} transition={{ duration: 0.35, repeat: Infinity }} />
      ) : mood === 'animado' ? (
        <path d={`M34 ${y + 5} Q40 ${y + 14} 46 ${y + 5} Z`} fill="#9D174D" stroke={eye} strokeWidth="1.2" strokeLinejoin="round" />
      ) : (
        <path d={`M35 ${y + 6} Q40 ${y + 11.5} 45 ${y + 6}`} stroke={eye} strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
    </>
  );
}

/**
 * Shared rig (feet, arms, sign) + the chosen character's body.
 * `celebrating` = jumping with both arms up and holding the "pedido novo" sign.
 */
export function MascotSvg({
  character = 'docinho',
  mood,
  walking,
  waving,
  celebrating = false,
  dancing = false,
  sign = 'Chegou pedido novo, eba! 🎉',
  size = 72,
}: {
  character?: Character;
  mood: Mood;
  walking: boolean;
  waving: boolean;
  celebrating?: boolean;
  /** wiggle-dance with both arms up (used when two mascots play together) */
  dancing?: boolean;
  /** text on the sign while celebrating; null = cheer with both arms, no sign */
  sign?: string | null;
  size?: number;
}) {
  const reduce = useReducedMotion();
  const ch = BODIES[character] ?? BODIES.docinho;
  const [lx, ly, rx, ry] = ch.shoulders;
  const step = walking && !reduce && !celebrating && !dancing;
  const jump = celebrating && !reduce;
  const dance = dancing && !reduce && !celebrating;
  const [line1, line2] = splitSign(sign ?? '');
  const arm = (d: string) => <path d={d} stroke="#7C3AED" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  const hand = (x: number, y: number) => <circle cx={x} cy={y} r="3.6" fill="#F9A8D4" stroke="#7C3AED" strokeWidth="1.5" />;

  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 80 92" aria-hidden="true" style={{ overflow: 'visible' }}>
      <motion.ellipse cx="40" cy="89" rx="19" ry="3" fill="#000" opacity="0.12" animate={jump ? { rx: [19, 13, 19] } : { rx: 19 }} transition={{ duration: 0.55, repeat: jump ? Infinity : 0 }} />

      <motion.g
        animate={jump ? { y: [0, -14, 0] } : dance ? { y: [0, -6, 0, -6, 0], rotate: [-9, 0, 9, 0, -9] } : { y: 0, rotate: 0 }}
        transition={jump ? { duration: 0.55, repeat: Infinity, ease: 'easeOut' } : dance ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
        style={{ originX: '40px', originY: '86px' }}
      >
        {/* feet */}
        <motion.g animate={step ? { rotate: [-12, 12, -12] } : { rotate: 0 }} transition={step ? { duration: 0.42, repeat: Infinity } : { duration: 0.2 }} style={{ originX: '32px', originY: '80px' }}>
          <rect x="27" y="79" width="10" height="8" rx="4" fill="#9D174D" />
        </motion.g>
        <motion.g animate={step ? { rotate: [12, -12, 12] } : { rotate: 0 }} transition={step ? { duration: 0.42, repeat: Infinity } : { duration: 0.2 }} style={{ originX: '48px', originY: '80px' }}>
          <rect x="43" y="79" width="10" height="8" rx="4" fill="#9D174D" />
        </motion.g>

        <motion.g animate={step ? { y: [0, -2.5, 0] } : { y: 0 }} transition={step ? { duration: 0.21, repeat: Infinity } : { duration: 0.2 }}>
          {/* body first: arms and the sign are drawn after it so they stay in front when raised */}
          {ch.body}
          <Face y={ch.face.y} light={ch.face.light} mood={mood} reduce={reduce} />
          {(celebrating || dancing) && !(celebrating && sign) ? (
            <>
              {/* both arms up: cheering / dancing */}
              {[
                [lx, ly, -1],
                [rx, ry, 1],
              ].map(([x, y, side], i) => (
                <motion.g
                  key={i}
                  animate={!reduce ? { rotate: [0, side * 16, 0] } : { rotate: 0 }}
                  transition={{ duration: dance ? 0.45 : 0.55, repeat: reduce ? 0 : Infinity, delay: i * 0.12 }}
                  style={{ originX: `${x}px`, originY: `${y}px` }}
                >
                  {arm(`M${x} ${y} Q${x + side * 8} ${y - 10} ${x + side * 9} ${y - 22}`)}
                  {hand(x + side * 9, y - 23)}
                </motion.g>
              ))}
            </>
          ) : celebrating ? (
            <>
              {/* sign held up on a stick by the right hand, left hand cheering */}
              <line x1={rx + 6} y1={ry - 22} x2={rx + 6} y2={-6} stroke="#A16207" strokeWidth="2.5" strokeLinecap="round" />
              <motion.g animate={jump ? { rotate: [-3, 3, -3] } : { rotate: 0 }} transition={{ duration: 0.55, repeat: jump ? Infinity : 0 }} style={{ originX: '40px', originY: '-6px' }}>
                <rect x="-14" y="-36" width="108" height="30" rx="7" fill="#FFF7ED" stroke="#DB2777" strokeWidth="2" />
                <text x="40" y={line2 ? -24 : -17} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#9D174D" fontFamily="Inter, system-ui, sans-serif">
                  {line1}
                </text>
                {line2 && (
                  <text x="40" y="-12.5" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#9D174D" fontFamily="Inter, system-ui, sans-serif">
                    {line2}
                  </text>
                )}
              </motion.g>
              {arm(`M${rx} ${ry} Q${rx + 6} ${ry - 10} ${rx + 6} ${ry - 20}`)}
              {hand(rx + 6, ry - 21)}
              <motion.g animate={jump ? { rotate: [0, -18, 0] } : { rotate: 0 }} transition={{ duration: 0.55, repeat: jump ? Infinity : 0 }} style={{ originX: `${lx}px`, originY: `${ly}px` }}>
                {arm(`M${lx} ${ly} Q${lx - 8} ${ly - 10} ${lx - 9} ${ly - 22}`)}
                {hand(lx - 9, ly - 23)}
              </motion.g>
            </>
          ) : (
            <>
              <motion.g
                animate={waving && !reduce ? { rotate: [0, -28, 8, -28, 0] } : { rotate: 0 }}
                transition={{ duration: 1.1, repeat: waving && !reduce ? Infinity : 0, repeatDelay: 0.6 }}
                style={{ originX: `${rx}px`, originY: `${ry}px` }}
              >
                {arm(`M${rx} ${ry} Q${rx + 8} ${ry - 6} ${rx + 10} ${ry - 14}`)}
                {hand(rx + 10.5, ry - 15)}
              </motion.g>
              {arm(`M${lx} ${ly} Q${lx - 7} ${ly + 4} ${lx - 8} ${ly + 10}`)}
            </>
          )}
        </motion.g>
      </motion.g>
    </svg>
  );
}

/** Splits the sign text in two balanced lines. */
function splitSign(text: string): [string, string | null] {
  if (text.length <= 18) return [text, null];
  const words = text.split(' ');
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}
