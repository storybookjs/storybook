import { readFileSync } from 'node:fs';

import { discoveredEntries, type Plan } from './qa-plan.ts';
import { Catalog, type CatalogEntry } from './schema.ts';

export const loadEntries = (plan?: Plan): CatalogEntry[] =>
  Catalog.parse([
    ...JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url), 'utf8')),
    ...(plan ? discoveredEntries(plan) : []),
  ]);
