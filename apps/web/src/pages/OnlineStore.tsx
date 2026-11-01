import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Camera, ExternalLink, MapPin, Plus, Store, Trash, Truck } from 'lucide-react';
import { shrinkImage } from '../lib/image';
import { useStore } from '../store/store';
import { money, uid } from '@cakeboss/domain/format';
import { activeZones, storeSettings } from '@cakeboss/domain/shop';
import type { Recipe, StoreSettings } from '@cakeboss/domain/types';
import { Badge, Button, Card, CardHeader, Field, IconButton, NumberInput, PageHeader, TextInput, cx } from '../components/ui';
import { Drawer, stagger, useToast } from '../components/motion';
import { Cake } from 'lucide-react';
import { OptionsEditor } from '../components/OptionsEditor';
import { Layers, Lock } from 'lucide-react';
import { PromotionsCard } from '../components/PromotionsEditor';
import { useWorkspace } from '../cloud/WorkspaceGate';

/** Admin side of the online store: delivery cities and fees, pickup, lead time and which products appear. */
export default function OnlineStorePage() {
  const { db, updateSettings, saveRecipe } = useStore();
  const toast = useToast();
  const [st, setSt] = useState<StoreSettings>(() => JSON.parse(JSON.stringify(storeSettings(db.settings))));
  const set = (p: Partial<StoreSettings>) => setSt((s) => ({ ...s, ...p }));
  // cakes are saved on their own (from the cake editor), so they don't count as unsaved changes here
  const dirty = JSON.stringify({ ...st, cakes: null, promotions: null }) !== JSON.stringify({ ...storeSettings(db.settings), cakes: null, promotions: null });
  const ws = useWorkspace();
  const hasStore = ws.features.includes('loja');
  const storePath = ws.slug ? `/loja/${ws.slug}` : '/loja';
  const cakes = storeSettings(db.settings).cakes ?? [];
  const priced = db.recipes.filter((r) => r.salePrice != null && r.salePrice > 0);
  const unpriced = db.recipes.filter((r) => !(r.salePrice != null && r.salePrice > 0));
  const storeOrders = db.orders.filter((o) => o.origin === 'loja');

  const save = () => {
    updateSettings({ store: { ...st, cakes, promotions: storeSettings(db.settings).promotions, zones: st.zones.map((z) => ({ ...z, city: z.city.trim() })).filter((z) => z.city) } }, 'Configurações da loja online atualizadas');
    toast('Loja online salva');
  };
  const toggleProduct = (r: Recipe, visible: boolean) => saveRecipe({ ...r, storeVisible: visible });
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const editing = db.recipes.find((r) => r.id === optionsFor) ?? null;

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <PageHeader
        title="Loja online"
        subtitle="O que os clientes veem e como compram: cidades atendidas, frete, retirada e produtos."
        actions={
          <>
            {hasStore ? (
              <Link to={storePath} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-subtle">
                <ExternalLink size={16} /> Abrir loja
              </Link>
            ) : (
              <span aria-disabled="true" title="A loja online não faz parte do plano Básico" className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg border border-line bg-subtle px-4 text-sm font-medium text-muted">
                <Lock size={16} /> Abrir loja
              </span>
            )}
            <Button variant="primary" onClick={save} disabled={!dirty || !hasStore}>
              {dirty ? 'Salvar alterações' : 'Salvo'}
            </Button>
          </>
        }
      />
      {!hasStore && (
        <motion.div variants={stagger.item} role="status" className="mb-5 flex flex-wrap items-center gap-4 rounded-card border border-pink/30 bg-pink-soft px-5 py-4">
          <Lock size={20} className="shrink-0 text-pink" />
          <div className="min-w-0 flex-1 text-sm">
            <b className="block text-[15px]">A loja online não faz parte do plano Básico</b>
            Nos planos Premium e Plus você monta a loja com a sua marca e recebe pedidos dos clientes.
          </div>
          <Link to="/plano" className="inline-flex h-10 items-center rounded-lg bg-pink px-4 text-sm font-medium text-white hover:bg-pink/90">
            Ver planos
          </Link>
        </motion.div>
      )}
      <motion.div variants={stagger.item} className="mb-5 rounded-card border border-warn/30 bg-warn-soft px-4 py-3 text-sm">
        <b>Modo demonstração.</b> A loja já funciona, mas os cadastros e pedidos ficam salvos só neste navegador. Para clientes comprarem do celular deles, com login pelo Google e
        pagamento pelo Mercado Pago, a loja precisa ser ligada à nuvem.
      </motion.div>

      {/* Básico: the settings show blurred behind the notice and can't be used */}
      <div
        className={cx('grid items-start gap-5 xl:grid-cols-2', !hasStore && 'pointer-events-none select-none opacity-60 blur-[3px]')}
        inert={!hasStore}
        aria-hidden={!hasStore || undefined}
      >
        <div className="space-y-5">
          <motion.div variants={stagger.item}>
            <Card>
              <CardHeader icon={<Store size={16} />} title="Geral" />
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-4">
                  <label className="relative grid h-20 w-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed border-pink/40 bg-pink-soft text-center text-[11px] text-pink hover:border-pink">
                    {st.logo ? <img src={st.logo} alt="Logo da loja" className="h-full w-full object-cover" /> : <span className="px-2">Enviar logo</span>}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) set({ logo: await shrinkImage(f, 360, 0.86) });
                      }}
                    />
                  </label>
                  <div className="min-w-0 flex-1 space-y-3">
                    <Field label="Nome da loja" hint="Em branco, usamos o nome da confeitaria.">
                      <TextInput value={st.storeName ?? ''} onChange={(e) => set({ storeName: e.target.value })} placeholder={db.settings.businessName} maxLength={60} />
                    </Field>
                    {st.logo && (
                      <button type="button" onClick={() => set({ logo: undefined })} className="text-xs font-medium text-loss hover:underline">
                        Remover logo
                      </button>
                    )}
                  </div>
                </div>
                <Field label="Frase da loja" hint="Aparece no rodapé da loja.">
                  <TextInput value={st.tagline ?? ''} onChange={(e) => set({ tagline: e.target.value })} placeholder="Delícias artesanais, feitas com carinho" maxLength={80} />
                </Field>
                <label className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block text-sm font-medium">Loja aberta</span>
                    <span className="text-xs text-muted">Fechada, os clientes veem um aviso e não conseguem comprar.</span>
                  </span>
                  <input type="checkbox" checked={st.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="h-5 w-5 accent-pink-600" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="WhatsApp da loja" hint="Para os clientes falarem com vocês e mandarem comprovantes.">
                    <TextInput value={st.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} inputMode="tel" placeholder="(47) 99999-9999" />
                  </Field>
                  <Field label="Antecedência mínima" hint="Dias entre o pedido e a entrega/retirada.">
                    <NumberInput value={st.leadDays} min={0} max={60} suffix="dias" onChange={(v) => set({ leadDays: Math.round(v) })} />
                  </Field>
                </div>
                <Field label="Endereço de retirada">
                  <TextInput value={st.pickupAddress} onChange={(e) => set({ pickupAddress: e.target.value })} placeholder="Rua, número, bairro — Navegantes" />
                </Field>
                <Field label="Texto de apresentação" hint="Aparece no topo da loja. Em branco, usamos um texto padrão.">
                  <textarea
                    rows={3}
                    value={st.about}
                    onChange={(e) => set({ about: e.target.value })}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-pink/60 focus:outline-none focus:ring-2 focus:ring-pink/20"
                  />
                </Field>
              </div>
            </Card>
          </motion.div>

          <motion.div variants={stagger.item}>
            <Card>
              <CardHeader icon={<Truck size={16} />} title="Cidades e frete" subtitle="Só cidades com frete preenchido aparecem para entrega. Deixe em branco para não atender." />
              <div className="p-5">
                <ul className="space-y-2">
                  {st.zones.map((z) => (
                    <li key={z.id} className="grid grid-cols-[1fr_150px_auto] items-center gap-2">
                      <div className="relative">
                        <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <TextInput aria-label="Cidade" className="pl-9" value={z.city} onChange={(e) => set({ zones: st.zones.map((x) => (x.id === z.id ? { ...x, city: e.target.value } : x)) })} />
                      </div>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>
                        <input
                          aria-label={`Frete para ${z.city}`}
                          inputMode="decimal"
                          placeholder="não atende"
                          value={z.fee === null ? '' : String(z.fee).replace('.', ',')}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            const n = parseFloat(raw.replace(',', '.'));
                            set({ zones: st.zones.map((x) => (x.id === z.id ? { ...x, fee: raw === '' ? null : Number.isFinite(n) && n >= 0 ? n : x.fee } : x)) });
                          }}
                          className={cx('h-10 w-full rounded-lg border bg-surface pl-9 pr-3 text-sm tabular focus:border-pink/60 focus:outline-none focus:ring-2 focus:ring-pink/20', z.fee === null ? 'border-dashed border-line' : 'border-line')}
                        />
                      </div>
                      <IconButton label="Remover cidade" onClick={() => set({ zones: st.zones.filter((x) => x.id !== z.id) })}>
                        <Trash size={15} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
                <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-pink hover:underline" onClick={() => set({ zones: [...st.zones, { id: uid(), city: '', fee: null }] })}>
                  <Plus size={15} /> Adicionar cidade
                </button>
                <p className="mt-3 text-xs text-muted">
                  Atendendo agora: {activeZones(st).length ? activeZones(st).map((z) => `${z.city} (${z.fee === 0 ? 'grátis' : money(z.fee)})`).join(', ') : 'nenhuma cidade — só retirada'}. Frete 0 = grátis.
                </p>
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="space-y-5">
          <motion.div variants={stagger.item}>
            <Link to="/fichas?aba=bolos" className="flex items-center gap-3 rounded-card border border-pink/30 bg-pink-soft/40 px-5 py-4 text-sm hover:bg-pink-soft">
              <Cake size={20} className="shrink-0 text-pink" />
              <span className="flex-1">
                <b>Bolos de aniversário</b> ({cakes.length}) — cadastrados em <b>Fichas técnicas → Bolos de aniversário</b>.
              </span>
              <span className="font-semibold text-pink">Abrir →</span>
            </Link>
          </motion.div>

          <motion.div variants={stagger.item}>
            <Card>
              <CardHeader title="Produtos na loja" subtitle="Aparecem os produtos com preço oficial. Desmarque para esconder; clique no quadrado para pôr a foto." />
              {priced.length === 0 ? (
                <p className="p-5 text-sm text-muted">
                  Nenhum produto com preço oficial ainda. Defina preços no{' '}
                  <Link to="/assistente" className="font-medium text-pink hover:underline">
                    Assistente de Precificação
                  </Link>
                  .
                </p>
              ) : (
                <ul className="divide-y divide-divider">
                  {priced.map((r) => (
                    <li key={r.id} className="space-y-2 px-5 py-3">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={r.storeVisible !== false} onChange={(e) => toggleProduct(r, e.target.checked)} className="h-4 w-4 accent-pink-600" aria-label={`Mostrar ${r.name} na loja`} />
                        <label
                          className="relative grid h-12 w-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-line bg-subtle text-muted hover:border-pink/50 hover:text-pink focus-within:ring-2 focus-within:ring-pink/40"
                          title={r.storeImage ? 'Trocar foto' : 'Adicionar foto'}
                        >
                          {r.storeImage ? <img src={r.storeImage} alt="" className="h-full w-full object-cover" /> : <Camera size={18} />}
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            aria-label={`Foto de ${r.name}`}
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (!f) return;
                              try {
                                saveRecipe({ ...r, storeImage: await shrinkImage(f) });
                                toast('Foto salva');
                              } catch (err) {
                                toast(err instanceof Error ? err.message : 'Não foi possível usar esta foto', 'error');
                              }
                            }}
                          />
                        </label>
                        <span className="flex-1 font-medium">{r.name}</span>
                        <span className="text-sm tabular">
                          {money(r.salePrice ?? 0)} / {r.unitLabel}
                        </span>
                      </div>
                      {r.storeImage && (
                        <button type="button" className="text-xs text-muted hover:text-loss" onClick={() => saveRecipe({ ...r, storeImage: undefined })}>
                          Remover foto
                        </button>
                      )}
                      {r.storeVisible !== false && (
                        <TextInput
                          aria-label={`Descrição de ${r.name}`}
                          defaultValue={r.storeDescription ?? ''}
                          placeholder="Descrição curta para a loja (opcional)"
                          onBlur={(e) => e.target.value !== (r.storeDescription ?? '') && saveRecipe({ ...r, storeDescription: e.target.value.trim() })}
                          className="h-9"
                        />
                      )}
                      {r.storeVisible !== false && (
                        <button
                          type="button"
                          onClick={() => setOptionsFor(r.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-medium hover:border-pink/40 hover:bg-pink-soft hover:text-pink"
                        >
                          <Layers size={14} />
                          {r.storeOptions?.length
                            ? `Opções: ${r.storeOptions.map((g) => `${g.name} (${g.choices.length})`).join(' · ')}`
                            : 'Tamanhos e sabores'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {unpriced.length > 0 && <p className="border-t border-divider px-5 py-3 text-xs text-muted">Sem preço (não aparecem): {unpriced.map((r) => r.name).join(', ')}</p>}
            </Card>
          </motion.div>

          <motion.div variants={stagger.item}>
            <PromotionsCard />
          </motion.div>

          <motion.div variants={stagger.item}>
            <Card>
              <CardHeader title="Pedidos da loja" subtitle="Chegam em Pedidos como “aguardando confirmação”." />
              <div className="flex items-center justify-between px-5 py-4 text-sm">
                <span>
                  {storeOrders.length} pedido{storeOrders.length === 1 ? '' : 's'} · {storeOrders.filter((o) => o.status === 'orcamento').length} aguardando confirmação
                </span>
                <Link to="/pedidos?filtro=orcamento" className="font-medium text-pink hover:underline">
                  Ver pedidos
                </Link>
              </div>
              <div className="border-t border-divider px-5 py-3 text-xs text-muted">
                Regras da loja: entrega só com <Badge tone="lilac">Pix</Badge> ou <Badge tone="lilac">cartão de crédito</Badge> pagos antes da produção; dinheiro só na retirada ou combinado pelo WhatsApp.
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
      <Drawer open={!!editing} onClose={() => setOptionsFor(null)} title={editing ? `Opções de ${editing.name}` : ''} width="max-w-2xl">
        {editing && (
          <OptionsEditor
            key={editing.id}
            recipe={editing}
            onCancel={() => setOptionsFor(null)}
            onSave={(groups) => {
              saveRecipe({ ...editing, storeOptions: groups.length ? groups : undefined });
              toast('Opções salvas');
              setOptionsFor(null);
            }}
          />
        )}
      </Drawer>
    </motion.div>
  );
}
