import { defineRenderer } from '../../../plugins.ts';

export default defineRenderer(() => ({
  meta: { name: 'fixture-annotation-renderer' },
  previewAnnotations: ['/renderer-preview.ts'],
  setup(): void {},
}));
