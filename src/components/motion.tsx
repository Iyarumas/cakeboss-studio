import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react';
import { Check, Info, TriangleAlert, X } from 'lucide-react';
import { cx } from './ui';

/** Number that springs to its new value. Renders the final value directly when reduced motion is on. */
export function AnimatedCounter({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (!Number.isFinite(value) || !Number.isFinite(from.current) || reduce) {
      from.current = value;
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <span className={cx('tabular', className)}>{format(shown)}</span>;
}

// screens are opened many times a day: a short, tight cascade, never a slow show
export const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.03 } } },
  item: { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.23, 1, 0.32, 1] as const } } },
};

/**
 * Hover/focus tooltip rendered in a portal with fixed positioning, so it is never
 * clipped by scrollable panels and always stays inside the window.
 */
export function Tip({ content, children, className, side = 'top' }: { content: ReactNode; children: ReactNode; className?: string; side?: 'top' | 'bottom' }) {
  const ref = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const below = side === 'bottom' || r.top < 120;
    setPos({ x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below });
  };
  // keep the bubble inside the viewport horizontally
  useLayoutEffect(() => {
    const el = tip.current;
    if (!pos || !el) return;
    const w = el.offsetWidth;
    const left = Math.min(Math.max(8, pos.x - w / 2), window.innerWidth - w - 8);
    el.style.left = `${left}px`;
    el.style.top = `${pos.below ? pos.y : pos.y - el.offsetHeight}px`;
  }, [pos]);
  return (
    <span ref={ref} className={cx('inline-flex', className)} onMouseEnter={show} onMouseLeave={() => setPos(null)} onFocus={show} onBlur={() => setPos(null)}>
      {children}
      {createPortal(
        <AnimatePresence>
          {pos && (
            <motion.span
              ref={tip}
              role="tooltip"
              initial={{ opacity: 0, y: pos.below ? -4 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              style={{ top: pos.y, left: pos.x }}
              className="pointer-events-none fixed z-[80] block w-max max-w-[280px] rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs font-normal leading-relaxed text-ink shadow-pop"
            >
              {content}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  );
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cx('relative w-full rounded-card border border-line bg-surface shadow-pop', width)}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <div className="flex items-center justify-between border-b border-divider px-5 py-4">
              <h2 className="text-[15px] font-semibold">{title}</h2>
              <button className="rounded-md p-1 text-muted hover:bg-subtle hover:text-ink" onClick={onClose} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 text-sm">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-divider px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Drawer({ open, onClose, title, children, side = 'right', width = 'max-w-md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; side?: 'right' | 'bottom'; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  const right = side === 'right';
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[55]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/25" onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            className={cx(
              'absolute flex flex-col border-line bg-surface shadow-pop',
              right ? cx('bottom-0 right-0 top-0 w-full border-l', width) : 'bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl border-t',
            )}
            initial={right ? { x: '100%' } : { y: '100%' }}
            animate={right ? { x: 0 } : { y: 0 }}
            exit={right ? { x: '100%' } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          >
            <div className="flex items-center justify-between border-b border-divider px-5 py-4">
              <h2 className="text-[15px] font-semibold">{title}</h2>
              <button className="rounded-md p-1 text-muted hover:bg-subtle hover:text-ink" onClick={onClose} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type ToastT = { id: number; tone: 'success' | 'error' | 'info'; text: string };
const ToastCtx = createContext<(text: string, tone?: ToastT['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastT[]>([]);
  const push = useCallback((text: string, tone: ToastT['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ type: 'spring', stiffness: 460, damping: 32 }}
              className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-line bg-surface py-2.5 pl-3 pr-4 text-sm shadow-pop"
            >
              <motion.span
                initial={{ scale: 0.4, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.05 }}
                className={cx(
                  'grid h-6 w-6 place-items-center rounded-full',
                  t.tone === 'success' ? 'bg-profit-soft text-profit' : t.tone === 'error' ? 'bg-loss-soft text-loss' : 'bg-lilac-soft text-lilac',
                )}
              >
                {t.tone === 'success' ? <Check size={14} /> : t.tone === 'error' ? <TriangleAlert size={14} /> : <Info size={14} />}
              </motion.span>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirmar',
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="h-9 rounded-lg border border-line px-4 text-sm font-medium hover:bg-subtle" onClick={onClose}>
            Cancelar
          </button>
          <button
            className={cx('h-9 rounded-lg px-4 text-sm font-medium text-white', danger ? 'bg-loss hover:bg-loss/90' : 'bg-pink hover:bg-pink/90')}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
