import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DB, Promotion, Recipe } from '@cakeboss/domain/types';
import { defaultStore } from '@cakeboss/domain/shop';
import { supabase } from '../lib/supabase';
import { StoreProvider, defaultSettings, emptyDb } from '../store/store';
import ShopApp from './ShopApp';

type PublicStore = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_path: string | null;
  description: string | null;
  accent: string | null;
  whatsapp: string | null;
  pickup: { enabled: boolean; address: string | null };
  delivery: { enabled: boolean; zones: { id: string; city: string; fee: number }[] };
  schedule: { lead_hours: number };
  products: { id: string; name: string; category: string; price: number; description: string | null; image_path: string | null; options: Recipe['storeOptions']; unit_label: string | null }[];
  promotions: { id: string; name: string; kind: Promotion['kind']; value: number; recipe_ids: string[]; starts_on: string | null; ends_on: string | null }[];
};

/** The public store payload (only showcase fields) turned into the shape the store screens already use. */
function toDb(s: PublicStore): DB {
  const recipes: Recipe[] = s.products.map((p) => ({
    id: p.id, name: p.name, category: p.category ?? '', salePrice: Number(p.price), targetMarginPct: 0, priceSnapshot: null,
    yield: 1, unitLabel: p.unit_label ?? 'un', prepMinutes: 0, wastePct: 0, waterLiters: 0, ingredients: [], materials: [], equipment: [], otherCosts: [],
    storeVisible: true, storeDescription: p.description ?? undefined, storeImage: p.image_path ?? undefined, storeOptions: p.options?.length ? p.options : undefined,
    createdAt: '', updatedAt: '',
  }));
  return {
    ...emptyDb(),
    recipes,
    settings: {
      ...defaultSettings(),
      businessName: s.name,
      accentShop: s.accent ?? undefined,
      store: {
        ...defaultStore(),
        enabled: true,
        whatsapp: s.whatsapp ?? '',
        pickupAddress: s.pickup.address ?? '',
        leadDays: Math.round((s.schedule.lead_hours ?? 48) / 24),
        about: s.description ?? '',
        zones: s.delivery.enabled ? s.delivery.zones.map((z) => ({ id: z.id, city: z.city, fee: Number(z.fee) })) : [],
        storeName: s.name,
        tagline: s.tagline ?? undefined,
        logo: s.logo_path ?? undefined,
        // built cakes need the server price check, which comes with online checkout
        cakes: [],
        promotions: s.promotions.map((p) => ({ id: p.id, name: p.name, kind: p.kind, value: Number(p.value), recipeIds: p.recipe_ids, startsOn: p.starts_on, endsOn: p.ends_on, active: true, createdAt: '' })),
      },
    },
  };
}

const noSave = () => {};

/** A bakery's own store at /loja/<slug>, read from the cloud. Shown only when the store is open and the plan includes it. */
export default function CloudShop() {
  const { slug = '' } = useParams();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; db: DB }>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    supabase.rpc('get_store', { store_slug: slug }).then(({ data, error }) => {
      if (!alive) return;
      if (error) setState({ status: 'error' });
      else if (!data) setState({ status: 'missing' });
      else {
        const s = data as PublicStore;
        document.title = `${s.name} · Cardápio`;
        setState({ status: 'ready', db: toDb(s) });
      }
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (state.status === 'loading') return <div className="grid min-h-screen place-items-center bg-bg text-muted">Abrindo a loja…</div>;
  if (state.status !== 'ready')
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">{state.status === 'missing' ? 'Loja não encontrada' : 'Não foi possível abrir a loja'}</h1>
          <p className="mt-2 text-muted">{state.status === 'missing' ? 'Confira o endereço com a confeitaria. A loja pode estar fechada no momento.' : 'Verifique sua internet e tente de novo.'}</p>
        </div>
      </div>
    );
  return (
    <StoreProvider key={slug} initial={state.db} persist={noSave}>
      <ShopApp base={`/loja/${slug}`} cloud />
    </StoreProvider>
  );
}
