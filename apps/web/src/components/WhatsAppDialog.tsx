import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, TriangleAlert } from 'lucide-react';
import { useStore } from '../store/store';
import { fillTemplate, firstName, missingVars, normalizePhone, waLink } from '@cakeboss/domain/whatsapp';
import { Button, Field, TextInput, cx } from './ui';
import { Modal } from './motion';

/**
 * Picks a ready-made message, fills it with the customer/order data and opens it in WhatsApp
 * (app or WhatsApp Web) so the user only has to press send.
 */
export function WhatsAppDialog({
  open,
  onClose,
  customerName,
  phone: initialPhone,
  orderVars,
}: {
  open: boolean;
  onClose: () => void;
  customerName: string;
  phone: string;
  /** present when sending about an order: enables order templates */
  orderVars?: Record<string, string>;
}) {
  const { db } = useStore();
  const templates = db.settings.messageTemplates.filter((t) => orderVars || t.scope === 'geral');
  const [tplId, setTplId] = useState(templates[0]?.id ?? '');
  const [phone, setPhone] = useState(initialPhone);
  const vars = useMemo(
    () => ({ cliente: firstName(customerName), confeitaria: db.settings.businessName, pix: db.settings.pixKey, ...orderVars }),
    [customerName, db.settings.businessName, db.settings.pixKey, orderVars],
  );
  const tpl = templates.find((t) => t.id === tplId);
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setPhone(initialPhone);
  }, [open, initialPhone]);
  useEffect(() => {
    setText(tpl ? fillTemplate(tpl.text, vars) : '');
    // re-fill only when the template, the dialog or the data actually change, so manual edits survive re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tplId, open, JSON.stringify(vars)]);

  const number = normalizePhone(phone);
  const missing = missingVars(text);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-lg"
      title="Enviar mensagem no WhatsApp"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!number || !text.trim()}
            onClick={() => {
              window.open(waLink(number, text), '_blank', 'noopener,noreferrer');
              onClose();
            }}
          >
            <MessageCircle size={16} /> Abrir no WhatsApp
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={`Telefone de ${customerName || 'cliente'}`} hint={phone && !number ? 'Número inválido — use DDD + número, ex.: (51) 99999-9999' : 'Com DDD. O código do Brasil (55) é colocado automaticamente.'}>
          <TextInput inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
        </Field>

        <div>
          <div className="mb-1.5 text-[13px] font-medium">Mensagem pronta</div>
          {templates.length === 0 ? (
            <p className="text-sm text-muted">
              Nenhuma mensagem pronta.{' '}
              <Link to="/configuracoes" className="font-medium text-pink hover:underline" onClick={onClose}>
                Criar em Configurações
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTplId(t.id)}
                  className={cx(
                    'h-8 rounded-full border px-3 text-[13px] font-medium transition-colors',
                    t.id === tplId ? 'border-pink/40 bg-pink-soft text-pink' : 'border-line text-muted hover:bg-subtle hover:text-ink',
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <Field label="Texto" hint="Você pode ajustar antes de abrir. A mensagem só é enviada quando você apertar enviar no WhatsApp.">
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed focus:border-pink/60 focus:outline-none focus:ring-2 focus:ring-pink/20"
          />
        </Field>
        {missing.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-warn">
            <TriangleAlert size={13} className="mt-px shrink-0" />
            <span>
              Falta preencher: {missing.map((m) => `{${m}}`).join(', ')}.
              {missing.includes('pix') && (
                <>
                  {' '}
                  Cadastre a chave Pix em{' '}
                  <Link to="/configuracoes" className="font-semibold underline" onClick={onClose}>
                    Configurações
                  </Link>
                  .
                </>
              )}
            </span>
          </p>
        )}
      </div>
    </Modal>
  );
}
