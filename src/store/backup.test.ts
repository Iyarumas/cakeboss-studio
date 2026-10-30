import { describe, expect, it } from 'vitest';
import { parseBackup } from './store';

describe('importar backup', () => {
  it('recusa arquivos que não são backup', () => {
    expect(parseBackup('não é json').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ foo: 1 })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ version: 2, settings: {}, recipes: [], ingredients: [] })).ok).toBe(false);
  });

  it('aceita um backup e completa listas que faltam (backups antigos)', () => {
    const r = parseBackup(JSON.stringify({ version: 1, settings: { businessName: 'Doces da Lê' }, recipes: [], ingredients: [] }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.orders).toEqual([]);
      expect(r.data.purchases).toEqual([]);
      expect(r.data.settings.businessName).toBe('Doces da Lê');
    }
  });
});
