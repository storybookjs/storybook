import preview from './preview.ts';
import Avatar from './Avatar.svelte';

const meta = preview.meta({
  title: 'SvelteFixtures/Csf4AvatarPlain',
  component: Avatar,
  args: { size: 48 },
});

export const Default = meta.story({
  args: { name: 'Ada Lovelace' },
});

export const Initials = meta.type<{ args: { initials: string } }>().story({
  args: { initials: 'AL' },
  render: (args) => ({
    Component: Avatar,
    props: { ...args, name: args.initials },
  }),
});
