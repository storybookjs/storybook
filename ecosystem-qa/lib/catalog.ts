import { readFileSync } from 'node:fs';

import { Catalog, type CatalogEntry } from './schema.ts';

export const loadCatalog = (): CatalogEntry[] =>
  Catalog.parse(JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url), 'utf8')));

export const loadCatalogEntry = (id: string): CatalogEntry => {
  const entries = loadCatalog();
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(
      `No catalog entry "${id}". Known: ${entries.map((candidate) => candidate.id).join(', ')}`
    );
  }
  return entry;
};
