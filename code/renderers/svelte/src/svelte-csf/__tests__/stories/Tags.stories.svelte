<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  const { Story } = defineMeta({
    title: 'Tags',
    parameters: {
      controls: { disable: true },
    },
    tags: ['!dev', '!autodocs', '!test'],
  });
</script>

<Story name="No Tags">No tags</Story>

<Story name="With Autodocs" tags={['autodocs']}>With autodocs</Story>

<Story name="With Dev" tags={['dev']}>With dev</Story>

<Story name="With Test" tags={['test']}>With test</Story>
