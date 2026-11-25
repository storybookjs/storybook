<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';

  import Viewer from './Viewer.svelte';

  const lines = ['a', 'b', 'c'];
  const html = `<pre>${lines.join('\n')}</pre>`;
  const changed = ['a'];
  changed.push('b');

  const { Story } = defineMeta({
    title: 'SvelteFixtures/ModuleLevelConstants',
    component: Viewer,
    args: { html, lines: lines.length },
  });
</script>

<Story name="Meta Args" exportName="MetaArgs" />

<Story name="Story Args" exportName="StoryArgs" args={{ selectedLine: lines.length - 1, heading: lines[0] }} />

<Story name="Changed Constant" exportName="ChangedConstant" args={{ selectedLine: changed.length }} />
