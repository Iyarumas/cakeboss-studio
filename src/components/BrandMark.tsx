import { cx } from './ui';

/** Full logo (cake + wordmark), background removed and trimmed to the artwork. */
export const LOGO_SRC = '/brand/cakeboss-logo-transparent.webp';
/** Just the cake from the logo, transparent, for icon sizes where the wordmark can't be read. */
export const MARK_SRC = '/brand/cakeboss-mark.webp';

/** The logo's cake on a cream tile, so it reads the same on light and dark surfaces. */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span className={cx('grid shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f6ece2] ring-1 ring-black/5', className)} style={{ width: size, height: size }}>
      <img src={MARK_SRC} alt="" draggable={false} className="h-[96%] w-[96%] select-none object-contain" />
    </span>
  );
}

/** The logo's own lettering ("CakeBoss" in chocolate and cream), cut from the logo file without changes. */
export const WORDMARK_SRC = '/brand/cakeboss-wordmark.webp';

/** Cake + lettering side by side, exactly as drawn in the logo. Lettering is 1105 × 297. */
export function BrandLockup({ height = 32, markSize, className }: { height?: number; markSize?: number; className?: string }) {
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-2', className)}>
      <img src={MARK_SRC} alt="" draggable={false} className="select-none object-contain" style={{ width: markSize ?? height * 1.35, height: markSize ?? height * 1.35 }} />
      <img src={WORDMARK_SRC} alt="CakeBoss" draggable={false} className="select-none object-contain" style={{ height, width: Math.round((height * 1105) / 297) }} />
    </span>
  );
}

/** Full logo with its chocolate wordmark. */
export function BrandLogo({ className }: { className?: string }) {
  return <img src={LOGO_SRC} alt="CakeBoss" draggable={false} className={cx('select-none object-contain', className)} />;
}
