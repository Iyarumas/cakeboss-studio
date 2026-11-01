import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageCircle, Plus, Trash } from 'lucide-react';
import { useStore } from '../store/store';
import { uid } from '@cakeboss/domain/format';
import { defaultTemplates, TEMPLATE_VARS } from '@cakeboss/domain/whatsapp';
import type { MessageTemplate } from '@cakeboss/domain/types';
import { Button, Card, CardHeader, Field, IconButton, Select, TextInput } from './ui';
import { ConfirmDialog, useToast } from './motion';

/** Edits the WhatsApp ready-made messages and the Pix key they use. Changes apply only on save. */
export function MessagesCard() {
  const { db, updateSettings } = useStore();
  const toast = useToast();
  const [pix, setPix] = useState(db.settings.pixKey);
  const [list, setList] = useState<MessageTemplate[]>(() => JSON.parse(JSON.stringify(db.settings.messageTemplates)));
  const [restore, setRestore] = useState(false);
  const areas = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const dirty = pix !== db.settings.pixKey || JSON.stringify(list) !== JSON.stringify(db.settings.messageTemplates);

  const update = (id: string, patch: Partial<MessageTemplate>) => setList((l) => l.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const insertVar = (t: MessageTemplate, key: string) => {
    const el = areas.current[t.id];
    const token = `{${key}}`;
    const at = el ? el.selectionStart : t.text.length;
    update(t.id, { text: t.text.slice(0, at) + token + t.text.slice(el ? el.selectionEnd : at) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  return (
    <Card>
      <CardHeader icon={<MessageCircle size={16} />} title="Mensagens prontas do WhatsApp" subtitle="Usadas nos botões de WhatsApp de Pedidos e Clientes." />
      <div className="space-y-5 p-5">
        <Field label="Chave Pix" hint="Entra no lugar de {pix} nas mensagens.">
          <TextInput value={pix} onChange={(e) => setPix(e.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
        </Field>

        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {list.map((t) => (
              <motion.li key={t.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }} className="rounded-xl border border-line bg-subtle/50 p-3">
                <div className="mb-2 grid grid-cols-[1fr_130px_auto] gap-2">
                  <TextInput aria-label="Nome da mensagem" value={t.name} onChange={(e) => update(t.id, { name: e.target.value })} placeholder="Nome (ex.: Pedido pronto)" />
                  <Select aria-label="Onde usar" value={t.scope} onChange={(e) => update(t.id, { scope: e.target.value as MessageTemplate['scope'] })}>
                    <option value="pedido">Pedidos</option>
                    <option value="geral">Pedidos e clientes</option>
                  </Select>
                  <IconButton label="Excluir mensagem" onClick={() => setList((l) => l.filter((x) => x.id !== t.id))}>
                    <Trash size={15} />
                  </IconButton>
                </div>
                <textarea
                  ref={(el) => {
                    areas.current[t.id] = el;
                  }}
                  aria-label="Texto da mensagem"
                  rows={4}
                  value={t.text}
                  onChange={(e) => update(t.id, { text: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed focus:border-pink/60 focus:outline-none focus:ring-2 focus:ring-pink/20"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {TEMPLATE_VARS.filter((v) => t.scope === 'pedido' || v.scope === 'geral').map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      title={`Inserir ${v.label}`}
                      onClick={() => insertVar(t, v.key)}
                      className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted hover:border-pink/40 hover:text-pink"
                    >
                      {`{${v.key}}`}
                    </button>
                  ))}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setList((l) => [...l, { id: uid(), name: '', scope: 'pedido', text: 'Oi, {cliente}! ' }])}>
              <Plus size={14} /> Nova mensagem
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRestore(true)}>
              Restaurar mensagens padrão
            </Button>
          </div>
          <Button
            variant="primary"
            disabled={!dirty}
            onClick={() => {
              if (list.some((t) => !t.name.trim() || !t.text.trim())) return toast('Dê nome e texto para cada mensagem', 'error');
              updateSettings({ pixKey: pix.trim(), messageTemplates: list.map((t) => ({ ...t, name: t.name.trim() })) }, 'Mensagens do WhatsApp atualizadas');
              toast('Mensagens salvas');
            }}
          >
            {dirty ? 'Salvar mensagens' : 'Salvo'}
          </Button>
        </div>
      </div>
      <ConfirmDialog open={restore} onClose={() => setRestore(false)} title="Restaurar mensagens padrão?" confirmLabel="Restaurar" onConfirm={() => setList(defaultTemplates())}>
        As mensagens desta lista voltam para o modelo original. Nada muda até você clicar em <b>Salvar mensagens</b>.
      </ConfirmDialog>
    </Card>
  );
}
