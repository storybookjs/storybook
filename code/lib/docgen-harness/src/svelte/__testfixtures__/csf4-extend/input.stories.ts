import preview from './preview.ts';
import Alert from './Alert.svelte';

const meta = preview.meta({
  title: 'SvelteFixtures/Csf4AlertPlain',
  component: Alert,
});

export const Base = meta.story({
  args: { title: 'Base title', level: 'warning' },
});

export const Inherited = Base.extend({});

export const Overridden = Base.extend({
  args: { level: 'error', dismissible: true },
});
