import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import { useStore } from '../store/store';
import { nowIso, uid } from '@cakeboss/domain/format';
import { activeZones, addressMissing, emptyAddress, storeSettings } from '@cakeboss/domain/shop';
import { emailTaken, normalizeEmail, signIn, signUp, validEmail } from '../lib/shopAuth';
import { normalizePhone } from '@cakeboss/domain/whatsapp';
import type { Address } from '@cakeboss/domain/types';
import { Button, Field, Segmented, Select, TextInput } from '../components/ui';
import { Modal } from '../components/motion';

export function AddressFields({ value, onChange, cities }: { value: Address; onChange: (a: Address) => void; cities: string[] }) {
  const set = (p: Partial<Address>) => onChange({ ...value, ...p });
  return (
    <div className="grid grid-cols-6 gap-3">
      <Field label="Cidade" className="col-span-6 sm:col-span-3">
        <Select value={value.city} onChange={(e) => set({ city: e.target.value })}>
          <option value="">Selecione</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>
      <Field label="Bairro" className="col-span-6 sm:col-span-3">
        <TextInput value={value.district} onChange={(e) => set({ district: e.target.value })} autoComplete="address-level3" />
      </Field>
      <Field label="Rua" className="col-span-4">
        <TextInput value={value.street} onChange={(e) => set({ street: e.target.value })} autoComplete="address-line1" />
      </Field>
      <Field label="Número" className="col-span-2">
        <TextInput value={value.number} onChange={(e) => set({ number: e.target.value })} inputMode="numeric" />
      </Field>
      <Field label="Complemento" className="col-span-6 sm:col-span-3">
        <TextInput value={value.complement} onChange={(e) => set({ complement: e.target.value })} placeholder="Apto, bloco…" autoComplete="address-line2" />
      </Field>
      <Field label="Ponto de referência" className="col-span-6 sm:col-span-3">
        <TextInput value={value.reference} onChange={(e) => set({ reference: e.target.value })} />
      </Field>
    </div>
  );
}

/** Login / sign-up for store customers. Sign-up creates the customer in Clientes. */
export function AuthDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { db, saveCustomer } = useStore();
  const cities = activeZones(storeSettings(db.settings)).map((z) => z.city);
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [withAddress, setWithAddress] = useState(false);
  const [address, setAddress] = useState<Address>(emptyAddress());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    if (mode === 'entrar') {
      setBusy(true);
      const r = await signIn(email, password);
      setBusy(false);
      if (!r.ok) return setError(r.error);
      if (!db.customers.some((c) => c.id === r.account.customerId)) return setError('Seu cadastro não foi encontrado. Fale com a confeitaria pelo WhatsApp.');
      return onDone();
    }
    if (name.trim().split(/\s+/).length < 2) return setError('Informe seu nome completo (nome e sobrenome).');
    if (!normalizePhone(phone)) return setError('Informe um WhatsApp válido com DDD.');
    if (!validEmail(email)) return setError('E-mail inválido.');
    if (emailTaken(email)) return setError('Já existe uma conta com este e-mail. Use "Entrar".');
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');
    if (withAddress && addressMissing(address)) return setError('Complete o endereço (cidade, bairro, rua e número) ou desmarque essa opção.');
    setBusy(true);
    const id = uid();
    const r = await signUp(email, password, id);
    if (!r.ok) {
      setBusy(false);
      return setError(r.error);
    }
    saveCustomer({
      id,
      name: name.trim().replace(/\s+/g, ' '),
      phone: phone.trim(),
      email: normalizeEmail(email),
      notes: 'Cadastro feito pela loja online',
      createdAt: nowIso(),
      address: withAddress ? address : undefined,
    });
    setBusy(false);
    onDone();
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === 'entrar' ? 'Entrar na sua conta' : 'Criar sua conta'} width="max-w-lg">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError('');
          }}
          options={[
            { value: 'entrar', label: 'Já tenho conta' },
            { value: 'criar', label: 'Criar conta' },
          ]}
        />
        <AnimatePresence initial={false}>
          {mode === 'criar' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
              <Field label="Nome completo">
                <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
              <Field label="WhatsApp" hint="Usamos para confirmar o pedido e combinar a entrega.">
                <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(47) 99999-9999" />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>
        <Field label="E-mail">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Senha" hint={mode === 'criar' ? 'Mínimo de 6 caracteres.' : undefined}>
          <div className="relative">
            <TextInput type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'criar' ? 'new-password' : 'current-password'} className="pr-10" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink" aria-label={show ? 'Esconder senha' : 'Mostrar senha'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        {mode === 'criar' && (
          <div className="rounded-xl border border-line p-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={withAddress} onChange={(e) => setWithAddress(e.target.checked)} className="h-4 w-4 accent-pink-600" />
              Já cadastrar endereço para entrega
            </label>
            <p className="mt-1 text-xs text-muted">Opcional agora — é pedido só se você escolher entrega.</p>
            {withAddress && (
              <div className="mt-3">
                {cities.length ? <AddressFields value={address} onChange={setAddress} cities={cities} /> : <p className="text-sm text-muted">No momento as entregas não estão disponíveis — apenas retirada.</p>}
              </div>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-loss-soft px-3 py-2 text-sm text-loss">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" className="h-11 w-full" disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : 'Criar conta'}
        </Button>
        <p className="text-center text-xs text-muted">Entrar com Google estará disponível quando a loja estiver na nuvem.</p>
      </form>
    </Modal>
  );
}
