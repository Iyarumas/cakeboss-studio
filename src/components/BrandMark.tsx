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

/** Full logo with its chocolate wordmark. */
export function BrandLogo({ className }: { className?: string }) {
  return <img src={LOGO_SRC} alt="CakeBoss" draggable={false} className={cx('select-none object-contain', className)} />;
}
