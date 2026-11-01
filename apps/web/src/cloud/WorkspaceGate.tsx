import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { FullScreenMessage } from '../auth/AuthPages';
import { supabase, type Plan } from '../lib/supabase';
import type { DB } from '@cakeboss/domain/types';
import { StoreProvider, defaultSettings, emptyDb, hasLocalData, loadLocal } from '../store/store';
import { Button, Field, TextInput } from '../components/ui';
import { useToast } from '../components/motion';
import { BrandMark } from '../components/BrandMark';
import { BRAND_DRAFT_KEY } from '../landing/draft';

export type SaveState = 'salvo' | 'pendente' | 'salvando' | 'erro';

interface Workspace {
  id: string;
  name: string;
  plan: Plan;
  saveState: SaveState;
  /** sends any change still waiting to be saved (used before signing out) */
  flush: () => Promise<void>;
}

const WorkspaceCtx = createContext<Workspace | null>(null);

export function useWorkspace() {
  const w = useContext(WorkspaceCtx);
  if (!w) throw new Error('useWorkspace fora do WorkspaceGate');
  return w;
}

type Loaded = { id: string; name: string; plan: Plan; data: DB; version: number };
type State = { status: 'loading' } | { status: 'none' } | { status: 'error'; message: string } | ({ status: 'ready' } & Loaded);

async function fetchWorkspace(userId: string): Promise<Loaded | null> {
  const { data: member, error: e1 } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', userId).order('created_at').limit(1).maybeSingle();
  if (e1) throw e1;
  if (!member) return null;
  const id = member.workspace_id as string;
  const [ws, data] = await Promise.all([
    supabase.from('workspaces').select('name, plan').eq('id', id).single(),
    supabase.from('workspace_data').select('data, version').eq('workspace_id', id).single(),
  ]);
  if (ws.error) throw ws.error;
  if (data.error) throw data.error;
  return { id, name: ws.data.name as string, plan: ws.data.plan as Plan, data: data.data.data as DB, version: data.data.version as number };
}

/**
 * Loads the signed-in person's confeitaria from the cloud (or asks them to create it) and runs the
 * system on that data, saving every change back a moment after it happens.
 */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!user) return;
    setState({ status: 'loading' });
    try {
      const w = await fetchWorkspace(user.id);
      setState(w ? { status: 'ready', ...w } : { status: 'none' });
    } catch {
      setState({ status: 'error', message: 'Não foi possível carregar os dados da sua confeitaria.' });
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === 'loading') return <FullScreenMessage>Abrindo sua confeitaria…</FullScreenMessage>;
  if (state.status === 'error') return <LoadError message={state.message} onRetry={load} />;
  if (state.status === 'none') return <CreateWorkspace onCreated={load} />;
  return (
    <CloudStore key={state.id} initial={state}>
      {children}
    </CloudStore>
  );
}

function CloudStore({ initial, children }: { initial: Loaded; children: ReactNode }) {
  const toast = useToast();
  // a new snapshot (with a new key) remounts the store when the data has to be replaced by the cloud's
  const [snapshot, setSnapshot] = useState({ data: initial.data, key: 0 });
  const [saveState, setSaveState] = useState<SaveState>('salvo');
  const version = useRef(initial.version);
  const pending = useRef<DB | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const replaceWithCloud = useCallback(
    async (message: string) => {
      const { data, error } = await supabase.from('workspace_data').select('data, version').eq('workspace_id', initial.id).single();
      if (error) {
        setSaveState('erro');
        return;
      }
      pending.current = null;
      version.current = data.version as number;
      setSnapshot((s) => ({ data: data.data as DB, key: s.key + 1 }));
      setSaveState('salvo');
      toast(message, 'info');
    },
    [initial.id, toast],
  );

  const flush = useCallback(async (): Promise<void> => {
    window.clearTimeout(timer.current);
    if (inFlight.current) {
      await inFlight.current;
      if (pending.current) return flush();
      return;
    }
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSaveState('salvando');
    const run = (async () => {
      const { data, error } = await supabase.rpc('save_workspace_data', { ws: initial.id, new_data: next, expected_version: version.current });
      if (error) {
        // keep the change and try again shortly; a newer change, if any, already includes this one
        pending.current ??= next;
        setSaveState('erro');
        timer.current = window.setTimeout(() => void flush(), 5000);
        return;
      }
      if (data === null) {
        await replaceWithCloud('Esta confeitaria foi alterada em outro aparelho. Carregamos a versão mais nova — confira sua última alteração.');
        return;
      }
      version.current = data as number;
      setSaveState(pending.current ? 'pendente' : 'salvo');
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
    if (pending.current) await flush();
  }, [initial.id, replaceWithCloud]);

  const persist = useCallback(
    (db: DB) => {
      pending.current = db;
      setSaveState('pendente');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 700);
    },
    [flush],
  );

  // coming back to the tab: pick up what another device saved meanwhile
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || pending.current || inFlight.current) return;
      const { data } = await supabase.from('workspace_data').select('version').eq('workspace_id', initial.id).single();
      if (data && (data.version as number) > version.current && !pending.current && !inFlight.current) await replaceWithCloud('Atualizamos com as alterações feitas em outro aparelho.');
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [initial.id, replaceWithCloud]);

  // closing the tab with a change still unsent: the browser asks before leaving
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!pending.current && !inFlight.current) return;
      void flush();
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [flush]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo<Workspace>(() => ({ id: initial.id, name: initial.name, plan: initial.plan, saveState, flush }), [initial, saveState, flush]);

  return (
    <WorkspaceCtx.Provider value={value}>
      <StoreProvider key={snapshot.key} initial={snapshot.data} persist={persist}>
        {children}
      </StoreProvider>
    </WorkspaceCtx.Provider>
  );
}

function GateCard({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-[440px] rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
        <BrandMark size={48} />
        {children}
      </div>
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { signOut } = useAuth();
  return (
    <GateCard>
      <h1 className="mt-5 text-xl font-bold tracking-tight">{message}</h1>
      <p className="mt-1.5 text-sm text-muted">Verifique sua internet e tente de novo. Seus dados continuam guardados no servidor.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onRetry}>
          <RefreshCw size={15} /> Tentar de novo
        </Button>
        <Button variant="ghost" onClick={() => void signOut()}>
          <LogOut size={15} /> Sair
        </Button>
      </div>
    </GateCard>
  );
}

function CreateWorkspace({ onCreated }: { onCreated: () => void }) {
  const { user, signOut } = useAuth();
  const meta = (user?.user_metadata ?? {}) as { full_name?: string };
  // first name from sign-up as a starting point; she can write it the way she likes to be called
  const [owner, setOwner] = useState((meta.full_name ?? '').trim().split(/\s+/)[0] ?? '');
  const [name, setName] = useState(() => {
    try {
      return sessionStorage.getItem(BRAND_DRAFT_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const canImport = useMemo(hasLocalData, []);
  const [importLocal, setImportLocal] = useState(canImport);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!owner.trim()) return setError('Digite como você quer ser chamada.');
    if (!name.trim()) return setError('Digite o nome da confeitaria.');
    setBusy(true);
    setError('');
    const base = importLocal ? loadLocal() : emptyDb();
    // both names are asked here; the mascots' first-access celebration still plays once inside the panel
    const data: DB = {
      ...base,
      settings: { ...defaultSettings(), ...base.settings, businessName: name.trim(), ownerName: owner.trim(), onboarded: false },
    };
    const { error: err } = await supabase.rpc('create_workspace', { ws_name: name.trim(), initial_data: data });
    setBusy(false);
    // created by another tab a moment ago: just open it
    if (err && !err.message.includes('already exists')) return setError('Não foi possível criar agora. Verifique sua internet e tente de novo.');
    onCreated();
  };

  return (
    <GateCard>
      <h1 className="mt-5 text-2xl font-extrabold">Vamos montar seu painel</h1>
      <p className="mt-1.5 text-sm text-muted">Só falta saber como te chamar e o nome da sua confeitaria. Dá para mudar depois em Configurações.</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Seu nome" hint="Como aparece na saudação do painel.">
          <TextInput value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Ex.: Letícia" autoComplete="given-name" autoFocus required />
        </Field>
        <Field label="Nome da confeitaria">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Doces da Lê" autoComplete="organization" required />
        </Field>
        {canImport && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-subtle/60 p-3 text-sm">
            <input type="checkbox" checked={importLocal} onChange={(e) => setImportLocal(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--pink))]" />
            <span>
              <span className="block font-medium text-ink">Trazer os dados deste navegador</span>
              <span className="text-muted">Encontramos receitas, pedidos ou clientes salvos aqui. Eles vão para a sua conta e passam a aparecer em qualquer aparelho.</span>
            </span>
          </label>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-loss/25 bg-loss-soft px-3 py-2.5 text-sm text-loss">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy} className="h-11 w-full">
          {busy && <Loader2 size={16} className="animate-spin" />}
          {busy ? 'Criando…' : 'Criar e abrir o painel'}
        </Button>
      </form>
      <p className="mt-5 text-center text-xs text-muted">
        Entrou com {user?.email}.{' '}
        <button type="button" onClick={() => void signOut()} className="font-medium text-pink hover:underline">
          Usar outra conta
        </button>
      </p>
    </GateCard>
  );
}
