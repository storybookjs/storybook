// Kept separate so tests can replace the default realm's store inventory.
import type { UniversalStore } from './index.ts';

export const instances: Map<string, UniversalStore<any, any>> = new Map();
