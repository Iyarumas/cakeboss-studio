import { useState } from 'react';
import { LifeBuoy, Mail, MessageCircle } from 'lucide-react';
import { APP_VERSION, SUPPORT } from '../config';
import { useStore } from '../store/store';
import { Button, Card, CardHeader, Field, Select } from './ui';

const SUBJECTS = ['Dúvida', 'Problema / erro', 'Sugestão', 'Recuperar ou apagar dados'];

/** Lets the user write to support through WhatsApp or e-mail with the message pre-filled. */
export function SupportCard() {
  const { db } = useStore();
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState('');
  const hasChannel = !!(SUPPORT.whatsapp || SUPPORT.email);

  const body = `${subject} — ${db.settings.businessName || 'DoceGestão'}\n\n${message.trim()}\n\n(DoceGestão v${APP_VERSION})`;
  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <Card>
      <CardHeader icon={<LifeBuoy size={16} />} title="Suporte" subtitle={hasChannel ? `Fale com a gente. ${SUPPORT.hours}` : undefined} />
      {!hasChannel ? (
        <p className="p-5 text-sm text-muted">O contato de suporte ainda não foi configurado.</p>
      ) : (
        <div className="space-y-3 p-5">
          <Field label="Assunto">
            <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Mensagem" hint="Conte o que aconteceu ou o que você precisa. Se for um erro, diga em qual tela.">
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-pink/60 focus:outline-none focus:ring-2 focus:ring-pink/20"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {SUPPORT.whatsapp && (
              <Button variant="primary" disabled={!message.trim()} onClick={() => open(`https://wa.me/${SUPPORT.whatsapp}?text=${encodeURIComponent(body)}`)}>
                <MessageCircle size={16} /> Enviar pelo WhatsApp
              </Button>
            )}
            {SUPPORT.email && (
              <Button
                disabled={!message.trim()}
                onClick={() => open(`mailto:${SUPPORT.email}?subject=${encodeURIComponent(`[DoceGestão] ${subject}`)}&body=${encodeURIComponent(body)}`)}
              >
                <Mail size={16} /> Enviar por e-mail
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">A mensagem abre no seu WhatsApp ou e-mail para você conferir antes de enviar.</p>
        </div>
      )}
    </Card>
  );
}
