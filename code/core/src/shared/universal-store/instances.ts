// this module just contains a map of all the instances of the UniversalStore
// it's a separate module so it can be mocked in tests
import type { UniversalStore } from '.';

export const instances: Map<string, UniversalStore<any, any>> = new Map();
