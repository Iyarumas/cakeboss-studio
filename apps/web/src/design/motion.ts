/**
 * Motion tokens for CakeBoss (docs: DESIGN.md › Movimento). CSS uses the same values as variables
 * (--ease-out, --dur-fast…) in index.css. Rules:
 *  - things opened from the keyboard many times a day (search, shortcuts) do not animate;
 *  - UI changes stay under 300ms; exits are faster than entrances;
 *  - only transform and opacity move; layout changes use layout animations, never width/height;
 *  - MotionConfig reducedMotion="user" in App.tsx drops travel and keeps fades for reduced motion.
 */

export const ease = {
  /** entering and responding: starts fast, settles softly */
  out: [0.23, 1, 0.32, 1] as const,
  /** moving across the screen */
  inOut: [0.77, 0, 0.175, 1] as const,
  /** drawers and sheets (iOS-like) */
  drawer: [0.32, 0.72, 0, 1] as const,
};

/** seconds, for motion/react */
export const dur = {
  press: 0.12,
  fast: 0.16,
  base: 0.22,
  slow: 0.32,
  /** a deliberately authored moment (landing, store), never routine UI */
  showcase: 0.6,
};

export const spring = {
  /** controls, tabs, indicators: quick, no visible bounce */
  snappy: { type: 'spring' as const, duration: 0.3, bounce: 0.08 },
  /** modals, drawers, cards that move to a new place */
  gentle: { type: 'spring' as const, duration: 0.45, bounce: 0.12 },
  /** celebrations and the cart: a little play, used rarely */
  playful: { type: 'spring' as const, duration: 0.5, bounce: 0.28 },
};

export const transition = {
  enter: { duration: dur.base, ease: ease.out },
  exit: { duration: dur.fast, ease: ease.out },
  fade: { duration: dur.fast, ease: 'easeOut' as const },
};

/** List and section entrances: short travel, tight stagger, never blocks interaction. */
export const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.03 } } },
  item: { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: transition.enter } },
};
