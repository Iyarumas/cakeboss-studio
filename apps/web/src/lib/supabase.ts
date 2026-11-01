import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** False when .env.local is missing: the app then says so instead of failing on every request. */
export const cloudConfigured = Boolean(url && key);

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type Plan = 'basico' | 'premium' | 'plus';

export const PLAN_LABEL: Record<Plan, string> = { basico: 'Básico', premium: 'Premium', plus: 'Plus' };

/** Turns Supabase auth errors into Portuguese messages that say what to do. */
export function authMessage(error: { message?: string; code?: string; status?: number } | null | undefined): string {
  if (!error) return '';
  const m = (error.message ?? '').toLowerCase();
  const c = error.code ?? '';
  if (c === 'invalid_credentials' || m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (c === 'email_not_confirmed' || m.includes('not confirmed')) return 'Confirme seu e-mail antes de entrar — o link está na sua caixa de entrada (veja também o spam).';
  if (c === 'user_already_exists' || m.includes('already registered')) return 'Já existe uma conta com este e-mail. Entre com sua senha ou recupere o acesso.';
  if (c === 'weak_password' || m.includes('password should')) return 'Senha fraca. Use pelo menos 8 caracteres, com letra maiúscula, minúscula, número e caractere especial.';
  if (c === 'over_email_send_rate_limit' || error.status === 429 || m.includes('rate limit')) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  if (c === 'same_password') return 'A nova senha precisa ser diferente da atual.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
  return 'Não foi possível concluir agora. Tente de novo em instantes.';
}
