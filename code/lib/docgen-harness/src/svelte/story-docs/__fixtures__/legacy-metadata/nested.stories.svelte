<script module>
  import { defineMeta } from '@storybook/svelte';
  import Inferred from './Inferred.svelte';

  const { Story } = defineMeta({ title: 'Nested', component: Inferred });
</script>

<div class="wrapper">
  <section>
    <Story name="Nested button" />
  </section>
</div>
