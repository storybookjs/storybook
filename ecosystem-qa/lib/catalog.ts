import { readFileSync } from 'node:fs';

import { Catalog } from './schema.ts';
import type { CatalogEntry } from './types.ts';

export const CATALOG_FILE = new URL('../catalog.json', import.meta.url);

export const parseCatalog = (json: unknown): CatalogEntry[] => Catalog.parse(json);

export const loadCatalogEntry = (id: string, file: URL | string = CATALOG_FILE): CatalogEntry => {
  const entries = parseCatalog(JSON.parse(readFileSync(file, 'utf8')));
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(
      `No catalog entry "${id}". Known: ${entries.map((candidate) => candidate.id).join(', ')}`
    );
  }
  return entry;
};
