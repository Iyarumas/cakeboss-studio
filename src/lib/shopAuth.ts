/**
 * Store accounts — DEMO MODE.
 * Accounts live in this browser only, with the password hashed (PBKDF2) and never stored in plain text.
 * When the store moves to the cloud this module is replaced by the real auth provider
 * (e-mail/password and "Entrar com Google"); the rest of the store only uses these functions.
 */

const ACCOUNTS_KEY = 'docegestao:loja:contas';
const SESSION_KEY = 'docegestao:loja:sessao';

export interface Account {
  email: string;
  salt: string;
  hash: string;
  customerId: string;
}

const read = (): Account[] => {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]') as Account[];
  } catch {
    return [];
  }
};
const write = (list: Account[]) => localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120_000, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export async function signUp(email: string, password: string, customerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = normalizeEmail(email);
  if (!validEmail(e)) return { ok: false, error: 'E-mail inválido.' };
  if (password.length < 6) return { ok: false, error: 'A senha precisa ter pelo menos 6 caracteres.' };
  const list = read();
  if (list.some((a) => a.email === e)) return { ok: false, error: 'Já existe uma conta com este e-mail. Entre com sua senha.' };
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  write([...list, { email: e, salt, hash: await hashPassword(password, salt), customerId }]);
  localStorage.setItem(SESSION_KEY, e);
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<{ ok: true; account: Account } | { ok: false; error: string }> {
  const e = normalizeEmail(email);
  const acc = read().find((a) => a.email === e);
  // same message for unknown e-mail and wrong password
  if (!acc || (await hashPassword(password, acc.salt)) !== acc.hash) return { ok: false, error: 'E-mail ou senha incorretos.' };
  localStorage.setItem(SESSION_KEY, e);
  return { ok: true, account: acc };
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}

export function currentAccount(): Account | null {
  const e = localStorage.getItem(SESSION_KEY);
  return e ? (read().find((a) => a.email === e) ?? null) : null;
}

export const emailTaken = (email: string) => read().some((a) => a.email === normalizeEmail(email));
