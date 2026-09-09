<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Input from './Input.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/Input',
    component: Input,
  });
</script>

<script lang="ts">
  let el = $state<HTMLInputElement | undefined>();
  let value = $state('');
</script>

<Story name="Default" args={{ value: 'typed', disabled: true, placeholder: 'Name' }} />

<Story name="Bound" args={{ font: 'mono', disabled: true }}>
  {#snippet template(args)}
    <Input
      bind:value
      bind:input={el}
      placeholder={`multi\nline`}
      error={null}
      {...args}
    />
  {/snippet}
</Story>
