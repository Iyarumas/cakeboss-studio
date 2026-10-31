import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2, Lock, Mail, MailCheck, TriangleAlert, User } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { AuthForm } from './AuthShell';
import { cx } from '../components/ui';
import { validEmail } from '../lib/shopAuth';

const ease = [0.23, 1, 0.32, 1] as const;

/** Large field with an icon; the icon and border take the accent color while typing. */
function AuthInput({ label, icon, aside, hint, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; icon: ReactNode; aside?: ReactNode; hint?: ReactNode }) {
  return (
    <label className="group block">
      <span className="mb-2 flex items-center justify-between text-sm font-medium text-ink">
        {label}
        {aside}
      </span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted transition-colors duration-150 group-focus-within:text-pink">{icon}</span>
        <input
          {...rest}
          className={cx(
            'h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-[15px] text-ink shadow-[0_1px_2px_rgb(16_24_40/0.04)] placeholder:text-muted/60',
            'transition-[border-color,box-shadow] duration-150 ease-out hover:border-ink/20 focus:border-pink/60 focus:outline-none focus:ring-4 focus:ring-pink/10',
            rest.className,
          )}
        />
        {rest.children}
      </span>
      {hint}
    </label>
  );
}

function PasswordInput({ id, label, value, onChange, autoComplete, aside, hint }: { id?: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; aside?: ReactNode; hint?: ReactNode }) {
  const inputId = id ?? autoComplete;
  const [show, setShow] = useState(false);
  return (
    <div className="group">
      <span className="mb-2 flex items-center justify-between text-sm font-medium text-ink">
        <label htmlFor={inputId}>{label}</label>
        {aside}
      </span>
      <div className="relative">
        <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted transition-colors duration-150 group-focus-within:text-pink" />
        <input
          id={inputId}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          className="h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-12 text-[15px] text-ink shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition-[border-color,box-shadow] duration-150 ease-out hover:border-ink/20 focus:border-pink/60 focus:outline-none focus:ring-4 focus:ring-pink/10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
          className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition-[color,background-color,transform] duration-150 hover:bg-subtle hover:text-ink active:scale-[0.94]"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={show ? 'off' : 'on'} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.12 }}>
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      {hint}
    </div>
  );
}

/** Password rule that ticks itself as the person types. */
function StrengthHint({ password }: { password: string }) {
  const rules = [
    { ok: password.length >= 8, label: 'Pelo menos 8 caracteres' },
    { ok: /[A-Z]/.test(password), label: '1 letra maiúscula' },
    { ok: /[a-z]/.test(password), label: '1 letra minúscula' },
    { ok: /\d/.test(password), label: '1 número' },
    { ok: /[^A-Za-z0-9\s]/.test(password), label: '1 caractere especial (ex.: ! @ # $ %)' },
  ];
  return (
    <ul className="mt-3 space-y-1.5" aria-live="polite">
      {rules.map((r) => (
        <li key={r.label} className={cx('flex items-center gap-2 text-[13px] transition-colors duration-200', r.ok ? 'font-medium text-profit' : 'text-muted')}>
          <span className={cx('grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors duration-200', r.ok ? 'bg-profit text-white' : 'border border-line bg-surface')}>
            <motion.span initial={false} animate={{ scale: r.ok ? 1 : 0, opacity: r.ok ? 1 : 0 }} transition={{ type: 'spring', duration: 0.3, bounce: 0.4 }} className="inline-flex">
              <Check size={10} strokeWidth={3.5} />
            </motion.span>
          </span>
          {r.label}
        </li>
      ))}
    </ul>
  );
}
/** Tells, while typing, whether the confirmation matches. */
function MatchHint({ password, confirm }: { password: string; confirm: string }) {
  if (!confirm) return null;
  const ok = confirm === password;
  return (
    <motion.p key={ok ? 'ok' : 'no'} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={cx('mt-2 flex items-center gap-1.5 text-xs font-medium', ok ? 'text-profit' : 'text-muted')} aria-live="polite">
      {ok ? <Check size={13} strokeWidth={3} /> : <TriangleAlert size={13} />}
      {ok ? 'As senhas são iguais' : 'Ainda diferente da senha acima'}
    </motion.p>
  );
}
const isStrong = (p: string) => p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9\s]/.test(p);
const WEAK = 'A senha precisa de pelo menos 8 caracteres, com 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial.';

/** Error box that slides in; a new message gives it a small shake so a repeated mistake is still noticed. */
function ErrorText({ children, attempt }: { children: ReactNode; attempt: number }) {
  return (
    <AnimatePresence initial={false}>
      {children && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease }} className="overflow-hidden">
          <motion.p
            key={attempt}
            role="alert"
            animate={{ x: [0, -6, 6, -3, 3, 0] }}
            transition={{ duration: 0.35 }}
            className="flex items-start gap-2.5 rounded-xl border border-loss/25 bg-loss-soft px-4 py-3 text-sm text-loss"
          >
            <TriangleAlert size={17} className="mt-px shrink-0" />
            {children}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-pink text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgb(var(--pink)/0.7)] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-pink/90 hover:shadow-[0_10px_24px_-8px_rgb(var(--pink)/0.8)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pink/25"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={busy ? 'busy' : 'idle'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="flex items-center gap-2">
          {busy && <Loader2 size={17} className="animate-spin" />}
          {children}
          {!busy && <ArrowRight size={17} className="transition-transform duration-200 ease-out group-hover:translate-x-1" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function TextLink({ to, state, children }: { to: string; state?: unknown; children: ReactNode }) {
  return (
    <Link to={to} state={state} className="font-semibold text-pink underline-offset-4 transition-colors hover:text-pink/80 hover:underline">
      {children}
    </Link>
  );
}

/** Confirmation panel used after sending an e-mail. */
function MailSent({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <motion.span
        initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.5, bounce: 0.35, delay: 0.1 }}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-pink-soft text-pink"
      >
        <MailCheck size={20} />
      </motion.span>
      <p className="text-[15px] leading-relaxed text-ink">{children}</p>
    </div>
  );
}

/** Where a signed-in visitor goes: back to the page that sent them to log in, or the dashboard. */
function useReturnTo() {
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;
  return from && from.startsWith('/') && !from.startsWith('/entrar') ? from : '/';
}

function useFormError() {
  const [error, setErr] = useState('');
  const [attempt, setAttempt] = useState(0);
  const setError = (m: string) => {
    setErr(m);
    if (m) setAttempt((a) => a + 1);
  };
  return { error, attempt, setError };
}

export function SignInPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const to = useReturnTo();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { error, attempt, setError } = useFormError();
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={to} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validEmail(email)) return setError('Digite um e-mail válido.');
    if (!password) return setError('Digite sua senha.');
    setBusy(true);
    setError('');
    const r = await signIn(email, password);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    navigate(to, { replace: true });
  };

  return (
    <AuthForm
      title="Que bom te ver de novo"
      subtitle="Entre para ver os pedidos de hoje e o que está no forno."
      footer={
        <>
          Primeira vez por aqui? <TextLink to="/criar-conta">Criar minha conta</TextLink>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <AuthInput label="E-mail" icon={<Mail size={18} />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="voce@email.com" autoFocus required />
        <PasswordInput
          label="Senha"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          aside={
            <Link to="/esqueci-senha" state={{ email }} className="text-sm font-medium text-pink hover:underline">
              Esqueci a senha
            </Link>
          }
        />
        <ErrorText attempt={attempt}>{error}</ErrorText>
        <SubmitButton busy={busy}>{busy ? 'Entrando…' : 'Entrar'}</SubmitButton>
      </form>
    </AuthForm>
  );
}

export function SignUpPage() {
  const { session, signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { error, attempt, setError } = useFormError();
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');

  if (session) return <Navigate to="/" replace />;

  if (sentTo)
    return (
      <AuthForm title="Falta só confirmar" subtitle="Sua conta foi criada." footer={<TextLink to="/entrar">Ir para o login</TextLink>}>
        <MailSent>
          Enviamos um link para <b>{sentTo}</b>. Abra o e-mail e toque no link para ativar a conta. Não chegou em alguns minutos? Veja a caixa de spam.
        </MailSent>
      </AuthForm>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().split(/\s+/).length < 2) return setError('Digite seu nome completo (nome e sobrenome).');
    if (!validEmail(email)) return setError('Digite um e-mail válido.');
    if (!isStrong(password)) return setError(WEAK);
    if (confirm !== password) return setError('As senhas não são iguais. Digite a mesma senha nos dois campos.');
    setBusy(true);
    setError('');
    const r = await signUp({ name, email, password });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (r.needsConfirmation) setSentTo(email.trim());
    else navigate('/', { replace: true });
  };

  return (
    <AuthForm
      title="Crie sua conta"
      subtitle="Leva menos de um minuto. O nome da sua confeitaria você coloca depois, já dentro do painel."
      footer={
        <>
          Já tem conta? <TextLink to="/entrar">Entrar</TextLink>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <AuthInput label="Nome completo" icon={<User size={18} />} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Letícia Souza" autoFocus required />
        <AuthInput label="E-mail" icon={<Mail size={18} />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="voce@email.com" required />
        <PasswordInput label="Senha" value={password} onChange={setPassword} autoComplete="new-password" hint={<StrengthHint password={password} />} />
        <PasswordInput
          id="confirmar-senha"
          label="Confirmar senha"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          hint={<MatchHint password={password} confirm={confirm} />}
        />
        <ErrorText attempt={attempt}>{error}</ErrorText>
        <SubmitButton busy={busy}>{busy ? 'Criando sua conta…' : 'Criar conta'}</SubmitButton>
      </form>
    </AuthForm>
  );
}

export function ForgotPasswordPage() {
  const { sendReset } = useAuth();
  const loc = useLocation();
  const [email, setEmail] = useState((loc.state as { email?: string } | null)?.email ?? '');
  const { error, attempt, setError } = useFormError();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validEmail(email)) return setError('Digite um e-mail válido.');
    setBusy(true);
    setError('');
    const r = await sendReset(email);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setSent(true);
  };

  const back = (
    <Link to="/entrar" className="group inline-flex items-center gap-1.5 font-semibold text-pink">
      <ArrowLeft size={16} className="transition-transform duration-200 group-hover:-translate-x-1" /> Voltar para o login
    </Link>
  );

  return (
    <AuthForm title={sent ? 'Confira seu e-mail' : 'Esqueceu a senha?'} subtitle={sent ? undefined : 'Sem problema. Mandamos um link para você criar uma senha nova.'} footer={back}>
      {sent ? (
        // same text whether or not the e-mail has an account, so the page doesn't reveal who is a customer
        <MailSent>
          Se existir uma conta com <b>{email.trim()}</b>, o link chega em alguns minutos. Abra o e-mail neste aparelho e toque no link. Veja também a caixa de spam.
        </MailSent>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <AuthInput label="E-mail da conta" icon={<Mail size={18} />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="voce@email.com" autoFocus required />
          <ErrorText attempt={attempt}>{error}</ErrorText>
          <SubmitButton busy={busy}>{busy ? 'Enviando…' : 'Enviar link'}</SubmitButton>
        </form>
      )}
    </AuthForm>
  );
}

export function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const { error, attempt, setError } = useFormError();
  const [busy, setBusy] = useState(false);

  if (loading)
    return (
      <AuthForm title="Nova senha">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin text-pink" /> Conferindo o link…
        </p>
      </AuthForm>
    );

  // the e-mail link signs the person in; without that session the link expired or was already used
  if (!session)
    return (
      <AuthForm title="Este link expirou" subtitle="Links de recuperação valem por pouco tempo e só podem ser usados uma vez." footer={<TextLink to="/entrar">Voltar para o login</TextLink>}>
        <button
          type="button"
          onClick={() => navigate('/esqueci-senha')}
          className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pink text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgb(var(--pink)/0.7)] transition-[background-color,transform] duration-150 ease-out hover:bg-pink/90 active:scale-[0.98]"
        >
          Pedir um link novo <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </AuthForm>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isStrong(password)) return setError(WEAK);
    setBusy(true);
    setError('');
    const r = await updatePassword(password);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    navigate('/', { replace: true });
  };

  return (
    <AuthForm title="Crie uma senha nova" subtitle={<>Para a conta <b className="text-ink">{session.user.email}</b>.</>}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <PasswordInput label="Nova senha" value={password} onChange={setPassword} autoComplete="new-password" hint={<StrengthHint password={password} />} />
        <ErrorText attempt={attempt}>{error}</ErrorText>
        <SubmitButton busy={busy}>{busy ? 'Salvando…' : 'Salvar e entrar'}</SubmitButton>
      </form>
    </AuthForm>
  );
}

/** Admin screens need an account: visitors go to /entrar and come back after logging in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullScreenMessage>Carregando…</FullScreenMessage>;
  if (!session) return <Navigate to="/entrar" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

export function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <p className="flex items-center gap-2 text-sm text-muted" role="status">
        <Loader2 size={16} className="animate-spin text-pink" /> {children}
      </p>
    </div>
  );
}
