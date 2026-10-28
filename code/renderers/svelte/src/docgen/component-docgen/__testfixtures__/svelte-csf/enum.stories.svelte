<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  import Button from './Button.svelte';
  import Other from './Other.svelte';
  const { Story } = defineMeta({ component: Button, subcomponents: { Other } });
</script>

<script lang="ts">
  enum Size {
    Small = 'small',
  }
</script>

<Story name="Primary" args={{ size: Size.Small }} />
