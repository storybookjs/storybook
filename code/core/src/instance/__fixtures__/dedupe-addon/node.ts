import { defineAddon } from '../../addons.ts';

export default defineAddon<{ color?: string } | void>(() => ({
  meta: { name: 'fixture-dedupe-addon' },
  setup(): void {},
}));
