import { describe, expect, it } from 'vitest';
import { activeZones, addressMissing, allowedPayments, cleanSelection, defaultStore, earliestDate, emptyAddress, lineKey, missingChoices, selectionLabel, startingPrice, storeProducts, unitPriceFor } from './shop';
import type { Recipe } from './types';

describe('loja online', () => {
  it('entrega aceita só Pix e cartão; retirada também aceita dinheiro', () => {
    expect(allowedPayments('entrega').map((m) => m.method)).toEqual(['pix', 'credito']);
    expect(allowedPayments('retirada').map((m) => m.method)).toEqual(['pix', 'credito', 'dinheiro']);
  });

  it('só oferece cidades com frete configurado (0 = grátis)', () => {
    const st = { ...defaultStore(), zones: [{ id: 'a', city: 'Navegantes', fee: 0 }, { id: 'b', city: 'Itajaí', fee: 12 }, { id: 'c', city: 'Penha', fee: null }] };
    expect(activeZones(st).map((z) => z.city)).toEqual(['Navegantes', 'Itajaí']);
    expect(activeZones(defaultStore())).toEqual([]);
  });

  it('respeita a antecedência mínima', () => {
    expect(earliestDate(2, new Date(2026, 9, 30, 10))).toBe('2026-11-01');
    expect(earliestDate(0, new Date(2026, 11, 31, 23))).toBe('2026-12-31');
  });

  it('mostra só produtos com preço e não escondidos', () => {
    const r = (id: string, salePrice: number | null, storeVisible?: boolean) => ({ id, salePrice, storeVisible }) as Recipe;
    expect(storeProducts([r('a', 10), r('b', null), r('c', 5, false), r('d', 0)]).map((x) => x.id)).toEqual(['a']);
  });

  it('exige cidade, bairro, rua e número no endereço', () => {
    expect(addressMissing(emptyAddress('Navegantes'))).toBe(true);
    expect(addressMissing({ ...emptyAddress('Navegantes'), district: 'Centro', street: 'Rua A', number: '1' })).toBe(false);
  });
});

describe('sabores e tamanhos', () => {
  const bolo = {
    id: 'bolo',
    salePrice: 120,
    storeOptions: [
      { id: 't', name: 'Tamanho', required: true, max: 1, choices: [{ id: 't15', name: '15 cm', priceDelta: -20 }, { id: 't20', name: '20 cm', priceDelta: 0 }, { id: 't25', name: '25 cm', priceDelta: 60 }] },
      { id: 'r', name: 'Recheio', required: true, max: 2, choices: [{ id: 'ninho', name: 'Ninho', priceDelta: 0 }, { id: 'nutella', name: 'Nutella', priceDelta: 15 }, { id: 'morango', name: 'Morango', priceDelta: 10 }] },
      { id: 'a', name: 'Adicionais', required: false, max: 3, choices: [{ id: 'topo', name: 'Topo', priceDelta: 25 }] },
    ],
  } as unknown as Recipe;

  it('soma os acréscimos das opções escolhidas', () => {
    expect(unitPriceFor(bolo, { t: ['t25'], r: ['nutella', 'morango'], a: ['topo'] })).toBe(120 + 60 + 15 + 10 + 25);
    expect(unitPriceFor(bolo, { t: ['t15'], r: ['ninho'] })).toBe(100);
  });

  it('"a partir de" usa a opção mais barata dos grupos obrigatórios', () => {
    expect(startingPrice(bolo)).toBe(100);
  });

  it('avisa o que falta escolher e respeita o limite de cada grupo', () => {
    expect(missingChoices(bolo, { t: ['t20'] })).toEqual(['Recheio']);
    expect(cleanSelection(bolo, { r: ['ninho', 'nutella', 'morango'], x: ['?'] })).toEqual({ r: ['ninho', 'nutella'] });
  });

  it('descreve a escolha e separa linhas diferentes no carrinho', () => {
    expect(selectionLabel(bolo, { t: ['t20'], r: ['ninho', 'morango'] })).toBe('Tamanho: 20 cm · Recheio: Ninho, Morango');
    expect(lineKey('bolo', { r: ['morango', 'ninho'], t: ['t20'] })).toBe(lineKey('bolo', { t: ['t20'], r: ['ninho', 'morango'] }));
    expect(lineKey('bolo', { t: ['t20'] })).not.toBe(lineKey('bolo', { t: ['t25'] }));
  });
});
