<script lang="ts" module>
  import { defineMeta, type Args, type StoryContext } from '@storybook/addon-svelte-csf';
  import Layout from './components/Layout.svelte';

  const { Story } = defineMeta<{ header: string }>({
    component: Layout,
    args: {
      mainFontSize: 'medium',
    },
  });
</script>

{#snippet template(args: Args<typeof Story>, context: StoryContext<typeof Story>)}
  <Layout {...args}>
    {#snippet header()}
      {args.header}
    {/snippet}
    {args.children}
    {#snippet footer()}
      {args.footer}
    {/snippet}
  </Layout>
{/snippet}

<Story name="Default" />

<Story name="With mainFontSize" args={{ mainFontSize: 'small' }} />

<Story name="With Header string" args={{ header: 'Header' }} />

<Story name="With Header and Footer snippet" parameters={{ customParameter: 'customValue' }}>
  {#snippet template(args, context)}
    <Layout {...args}>
      {#snippet header()}
        This is a header: {context.parameters.customParameter}
      {/snippet}
      {args.children}
      {#snippet footer()}
        This is a footer
      {/snippet}
    </Layout>
  {/snippet}
</Story>
