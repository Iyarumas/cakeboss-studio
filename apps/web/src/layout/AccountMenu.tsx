import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, CloudOff, Loader2, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useWorkspace } from '../cloud/WorkspaceGate';
import { PLAN_LABEL } from '../lib/supabase';
import { Badge, cx } from '../components/ui';

/** Quiet save status next to the avatar: only "Salvando…" and errors draw attention. */
export function SaveIndicator() {
  const { saveState } = useWorkspace();
  const label = { salvo: 'Salvo na nuvem', pendente: 'Salvando…', salvando: 'Salvando…', erro: 'Sem conexão — tentando de novo' }[saveState];
  return (
    <span role="status" aria-live="polite" title={label} className={cx('hidden items-center gap-1.5 text-xs md:inline-flex', saveState === 'erro' ? 'font-medium text-loss' : 'text-muted')}>
      {saveState === 'erro' ? <CloudOff size={14} /> : saveState === 'salvo' ? <Check size={14} className="text-profit" /> : <Loader2 size={14} className="animate-spin" />}
      <span className="hidden xl:inline">{label}</span>
    </span>
  );
}

export function AccountMenu({ initials, ownerName }: { initials: string; ownerName: string }) {
  const { user, signOut } = useAuth();
  const ws = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const leave = async () => {
    setLeaving(true);
    // never drop a change that is still on its way to the server
    await ws.flush();
    await signOut();
  };

  const item = 'flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-ink transition-colors hover:bg-subtle disabled:opacity-60';

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Conta"
        className="grid h-8 w-8 place-items-center rounded-full bg-lilac-soft text-xs font-semibold text-lilac ring-1 ring-lilac/20 transition-[background-color,color,transform] duration-150 ease-out hover:bg-lilac hover:text-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40"
      >
        {initials}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-10 z-50 w-64 rounded-card border border-line bg-surface p-1.5 shadow-pop"
          >
            <div className="border-b border-divider px-2.5 pb-3 pt-2">
              <div className="truncate text-sm font-semibold text-ink">{ownerName || ws.name}</div>
              <div className="truncate text-xs text-muted">{user?.email}</div>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                <span className="truncate">{ws.name}</span>
                <Badge tone="lilac">Plano {PLAN_LABEL[ws.plan]}</Badge>
              </div>
            </div>
            <div className="pt-1.5">
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  setOpen(false);
                  navigate('/configuracoes');
                }}
              >
                <Settings size={16} className="text-muted" /> Configurações
              </button>
              <button type="button" role="menuitem" className={item} onClick={leave} disabled={leaving}>
                {leaving ? <Loader2 size={16} className="animate-spin text-muted" /> : <LogOut size={16} className="text-muted" />}
                {leaving ? 'Saindo…' : 'Sair'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
