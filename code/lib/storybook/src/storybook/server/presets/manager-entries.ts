import { builtInAddons } from '../../../features/index.ts';

export function getBuiltInManagerEntries(): string[] {
  return builtInAddons
    .filter((addon) => addon.manager)
    .toSorted((a, b) => a.meta.order! - b.meta.order!)
    .map((addon) => addon.manager!);
}
