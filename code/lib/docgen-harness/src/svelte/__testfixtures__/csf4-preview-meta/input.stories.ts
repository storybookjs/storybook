import preview from './preview.ts';
import Tag from './Tag.svelte';

const meta = preview.meta({
  title: 'SvelteFixtures/Csf4TagPlain',
  component: Tag,
  args: { label: 'Meta label' },
});

/** Inherits the meta args. */
export const Default = meta.story();

export const Success = meta.story({
  args: { tone: 'success', removable: true },
});
