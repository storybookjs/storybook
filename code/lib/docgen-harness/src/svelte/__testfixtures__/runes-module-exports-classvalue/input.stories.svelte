<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Avatar from './Avatar.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/Avatar',
    component: Avatar,
  });
</script>

<Story name="Default" args={{ name: 'Ada', size: 32, href: '/ada', letter: 'A' }} />

<Story name="Static">
  {#snippet template()}
    <Avatar name="Static" size={16} />
  {/snippet}
</Story>

<Story name="Tagged" tags={['!dev']} args={{ name: 'Tagged' }} />

<Story name="Wrapped" asChild parameters={{ layout: 'fullscreen' }}>
  <div class="wrap">
    <Avatar name="Wrapped" />
  </div>
</Story>
