<script module lang="ts">
  import preview from '../../../.storybook/preview';
  import Tag from './Tag.svelte';

  const { Story } = preview.meta({ title: 'Repro/Tag', component: Tag });
</script>

<Story name="Default" args={{ label: 'Design' }} />
