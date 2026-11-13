<script module lang="ts">
  import preview from './preview.ts';
  import Avatar from './Avatar.svelte';

  const meta = preview.meta({
    title: 'SvelteFixtures/Csf4Avatar',
    component: Avatar,
    args: { size: 48 },
  });
  const { Story } = meta;
  const { Story: InitialsStory } = meta.type<{ args: { initials: string } }>();
</script>

<Story name="Default" args={{ name: 'Ada Lovelace' }} />

<InitialsStory name="Initials" args={{ initials: 'AL' }}>
  {#snippet template({ initials, ...args })}
    <Avatar {...args} name={initials} />
  {/snippet}
</InitialsStory>
