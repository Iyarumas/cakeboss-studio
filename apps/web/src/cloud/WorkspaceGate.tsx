import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { FullScreenMessage } from '../auth/AuthPages';
import { supabase, type Plan } from '../lib/supabase';
import type { DB } from '@cakeboss/domain/types';
import { PLANS, planPrice } from '@cakeboss/domain/plans';
import { StoreProvider, defaultSettings, emptyDb, hasLocalData, loadLocal } from '../store/store';
import { Button, Field, TextInput } from '../components/ui';
import { BrandMark } from '../components/BrandMark';
import { BRAND_DRAFT_KEY } from '../landing/draft';
import { loadTenant, saveDiff } from './tables';
import { PayButtons } from '../pages/Subscription';

export type SaveState = 'salvo' | 'pendente' | 'salvando' | 'erro';

interface Workspace {
  id: string;
  name: string;
  /** public address of the store: /loja/<slug> */
  slug: string | null;
  /** current plan, or null while no subscription or grant is active */
  plan: Plan | null;
  /** what the plan unlocks, as the database computes it ('gestao', 'loja', 'mensagens'…) */
  features: string[];
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

type Access = { plan: Plan | null; status: string | null; features: string[] };
type Loaded = { id: string; name: string; slug: string | null; access: Access; data: DB };
type State = { status: 'loading' } | { status: 'none' } | { status: 'error'; message: string } | { status: 'no-plan'; id: string; name: string; access: Access } | ({ status: 'ready' } & Loaded);

async function fetchAccess(id: string): Promise<Access> {
  const { data, error } = await supabase.rpc('my_workspace_access', { ws: id });
  if (error) throw error;
  const a = (data ?? {}) as { features?: string[]; subscription?: { plan?: Plan; status?: string } | null };
  return { plan: a.subscription?.plan ?? null, status: a.subscription?.status ?? null, features: a.features ?? [] };
}

async function fetchWorkspace(userId: string): Promise<{ id: string; name: string; slug: string | null; access: Access; data: DB | null } | null> {
  const { data: member, error: e1 } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', userId).order('created_at').limit(1).maybeSingle();
  if (e1) throw e1;
  if (!member) return null;
  const id = member.workspace_id as string;
  const [ws, access, legacy] = await Promise.all([
    supabase.from('workspaces').select('name, slug').eq('id', id).single(),
    fetchAccess(id),
    supabase.from('workspace_data').select('imported_at').eq('workspace_id', id).maybeSingle(),
  ]);
  if (ws.error) throw ws.error;
  if (legacy.error) throw legacy.error;
  // a confeitaria created with data from this browser: copy it into the tables once
  if (legacy.data && !legacy.data.imported_at) {
    const { error } = await supabase.rpc('import_my_workspace_data', { ws: id });
    if (error) throw error;
  }
  return { id, name: ws.data.name as string, slug: (ws.data.slug as string) ?? null, access, data: access.features.length ? await loadTenant(id) : null };
}

/**
 * Loads the signed-in person's confeitaria from the cloud (or asks them to create it) and runs the
 * system on that data, saving each change to its own rows a moment after it happens.
 */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!user) return;
    setState({ status: 'loading' });
    try {
      const w = await fetchWorkspace(user.id);
      if (!w) setState({ status: 'none' });
      else if (!w.data) setState({ status: 'no-plan', id: w.id, name: w.name, access: w.access });
      else setState({ status: 'ready', id: w.id, name: w.name, slug: w.slug, access: w.access, data: w.data });
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
  if (state.status === 'no-plan') return <ChoosePlan id={state.id} name={state.name} access={state.access} onChanged={load} />;
  return (
    <CloudStore key={state.id} initial={state}>
      {children}
    </CloudStore>
  );
}

function CloudStore({ initial, children }: { initial: Loaded; children: ReactNode }) {
  const [saveState, setSaveState] = useState<SaveState>('salvo');
  // the version last written to the cloud, and the newest one waiting to be written
  const saved = useRef<DB>(initial.data);
  const pending = useRef<DB | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<number | undefined>(undefined);

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
      try {
        await saveDiff(initial.id, saved.current, next);
        saved.current = next;
        setSaveState(pending.current ? 'pendente' : 'salvo');
      } catch {
        // keep the change (a newer one already includes it) and try again shortly
        pending.current ??= next;
        setSaveState('erro');
        timer.current = window.setTimeout(() => void flush(), 5000);
      }
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
    if (pending.current) await flush();
  }, [initial.id]);

  const persist = useCallback(
    (db: DB) => {
      pending.current = db;
      setSaveState('pendente');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 700);
    },
    [flush],
  );

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

  const value = useMemo<Workspace>(
    () => ({ id: initial.id, name: initial.name, slug: initial.slug, plan: initial.access.plan, features: initial.access.features, saveState, flush }),
    [initial, saveState, flush],
  );

  return (
    <WorkspaceCtx.Provider value={value}>
      <StoreProvider initial={initial.data} persist={persist}>
        {children}
      </StoreProvider>
    </WorkspaceCtx.Provider>
  );
}

/** Shown while the confeitaria has no active plan: the choice is recorded; access opens when billing confirms it. */
function ChoosePlan({ id, name, access, onChanged }: { id: string; name: string; access: Access; onChanged: () => void }) {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  // trial days the server offered for the plan just chosen (it decides again at checkout)
  const [trialDays, setTrialDays] = useState(0);
  const choose = async (plan: string) => {
    setBusy(plan);
    setError('');
    const { data, error: err } = await supabase.rpc('choose_plan', { ws: id, plan });
    setBusy(null);
    if (err) return setError('Não foi possível registrar o plano agora. Tente de novo.');
    setTrialDays((data as { trial_days?: number } | null)?.trial_days ?? 0);
    onChanged();
  };
  const waiting = access.status === 'billing_not_configured' || access.status === 'pending_payment';
  const canPay = access.status === 'pending_payment';
  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <BrandMark size={48} />
        <h1 className="mt-5 text-2xl font-extrabold">{waiting ? 'Plano escolhido' : `Escolha o plano da ${name}`}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          {canPay
            ? `Você escolheu o ${PLANS.find((p) => p.code === access.plan)?.name ?? 'plano'}. Falta só o pagamento para liberar o painel. Seus dados já estão guardados.`
            : waiting
            ? `Você escolheu o ${PLANS.find((p) => p.code === access.plan)?.name ?? 'plano'}. As assinaturas do CakeBoss abrem em breve: assim que a cobrança começar, você cadastra o cartão ou paga no Pix e o painel é liberado. Seus dados já estão guardados.`
            : 'As assinaturas abrem em breve. Escolha agora o plano que quer usar; quando a cobrança começar, você cadastra o cartão ou paga no Pix e o painel é liberado.'}
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.code} className={'rounded-card border bg-surface p-5 ' + (access.plan === p.code ? 'border-pink' : 'border-line')}>
              <div className="text-lg font-bold">{p.name}</div>
              <div className="mt-1 text-2xl font-extrabold tabular">
                {planPrice(p.priceCents)}
                <span className="text-sm font-medium text-muted"> /mês</span>
              </div>
              <p className="mt-2 text-sm">{p.forWho}</p>
              <p className="mt-2 text-xs text-muted">{p.includes}</p>
              <Button className="mt-4 w-full" variant={access.plan === p.code ? 'secondary' : 'primary'} disabled={!!busy || access.plan === p.code} onClick={() => void choose(p.code)}>
                {busy === p.code && <Loader2 size={15} className="animate-spin" />}
                {access.plan === p.code ? 'Plano escolhido' : `Escolher ${p.name}`}
              </Button>
            </div>
          ))}
        </div>
        {canPay && (
          <div className="mt-6 rounded-card border border-line bg-surface p-5">
            <div className="font-semibold">Concluir o pagamento</div>
            <p className="mb-4 mt-1 text-sm text-muted">O pagamento abre no Mercado Pago. O CakeBoss não vê nem guarda os dados do seu cartão.</p>
            <PayButtons workspaceId={id} trialDays={trialDays} onMessage={setError} />
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-loss/25 bg-loss-soft px-3 py-2.5 text-sm text-loss">
            {error}
          </p>
        )}
        <button type="button" onClick={() => void signOut()} className="mt-6 text-sm font-medium text-pink hover:underline">
          Sair
        </button>
      </div>
    </div>
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
