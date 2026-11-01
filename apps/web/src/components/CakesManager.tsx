import { useState } from 'react';
import { motion } from 'motion/react';
import { Cake, Plus } from 'lucide-react';
import { useStore } from '../store/store';
import { money } from '@cakeboss/domain/format';
import { cakeStartingPrice } from '@cakeboss/domain/cake';
import { storeSettings } from '@cakeboss/domain/shop';
import type { CakeProduct } from '@cakeboss/domain/types';
import { Badge, Button, Card, CardHeader, EmptyState } from './ui';
import { ConfirmDialog, Drawer, stagger, useToast } from './motion';
import { CakeEditor, newCake } from './CakeEditor';

/** Birthday cakes the customer builds in the store (lives in Fichas técnicas → Bolos de aniversário). */
export function CakesManager() {
  const { db, ctx, updateSettings } = useStore();
  const toast = useToast();
  const cakes = storeSettings(db.settings).cakes ?? [];
  const [edit, setEdit] = useState<CakeProduct | null>(null);
  const [del, setDel] = useState<CakeProduct | null>(null);
  const saveCakes = (list: CakeProduct[], msg: string) => updateSettings({ store: { ...storeSettings(db.settings), cakes: list } }, msg);
  const exists = (id: string) => cakes.some((x) => x.id === id);

  return (
    <motion.div variants={stagger.item}>
      <Card>
        <CardHeader
          icon={<Cake size={16} />}
          title="Bolos de aniversário"
          subtitle="O cliente monta na loja: tamanho, massa, recheios e cobertura. O preço sai das fichas de cada parte."
          actions={
            <Button size="sm" variant="primary" onClick={() => setEdit(newCake())}>
              <Plus size={14} /> Novo bolo
            </Button>
          }
        />
        {cakes.length === 0 ? (
          <EmptyState
            icon={<Cake size={22} />}
            title="Nenhum bolo de aniversário ainda"
            text="O cadastro é guiado em 6 passos: nome, massas, recheios, coberturas, tamanhos e a prévia dos preços."
            action={
              <Button variant="primary" onClick={() => setEdit(newCake())}>
                <Plus size={16} /> Cadastrar bolo
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-divider">
            {cakes.map((ck) => {
              const from = cakeStartingPrice(ck, db.recipes, ctx, db.settings);
              return (
                <li key={ck.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-pink-soft text-xl">{ck.image ? <img src={ck.image} alt="" className="h-full w-full object-cover" /> : '🎂'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {ck.name} {!ck.visible && <Badge tone="gray">fora da loja</Badge>}
                    </div>
                    <div className="text-xs text-muted">
                      {ck.sizes.length} tamanhos · {ck.massas.length} massas · {ck.recheios.length} recheios · {ck.coberturas.length} coberturas
                      {from !== null && ` · a partir de ${money(from)}`}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setEdit(ck)}>
                    Editar
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Drawer open={!!edit} onClose={() => setEdit(null)} title={edit && exists(edit.id) ? `Editar ${edit.name}` : 'Novo bolo de aniversário'} width="max-w-3xl">
        {edit && (
          <CakeEditor
            key={edit.id}
            initial={edit}
            onCancel={() => setEdit(null)}
            onDelete={exists(edit.id) ? () => setDel(edit) : undefined}
            onSave={(ck) => {
              saveCakes(exists(ck.id) ? cakes.map((x) => (x.id === ck.id ? ck : x)) : [...cakes, ck], `Bolo de aniversário ${exists(ck.id) ? 'atualizado' : 'criado'}: ${ck.name}`);
              toast('Bolo salvo');
              setEdit(null);
            }}
          />
        )}
      </Drawer>
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        danger
        title="Excluir bolo de aniversário?"
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!del) return;
          saveCakes(cakes.filter((x) => x.id !== del.id), `Bolo de aniversário excluído: ${del.name}`);
          toast('Bolo excluído');
          setEdit(null);
        }}
      >
        <b>{del?.name}</b> sai da loja. As fichas técnicas das massas e recheios continuam cadastradas.
      </ConfirmDialog>
    </motion.div>
  );
}
