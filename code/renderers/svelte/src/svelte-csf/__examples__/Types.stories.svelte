<script lang="ts" module>
  import { defineMeta, type StoryContext } from '../src/index.js';
  import Layout from './components/Layout.svelte';
  import type { ComponentProps } from 'svelte';

  const { Story } = defineMeta({
    render: template,
    // component: Layout,
    args: {
      mainFontSize: 'large',
      footer: 'a string',
      children: 'asdf',
      header: 'a string',
    },
  });

  type Args = Omit<ComponentProps<typeof Layout>, 'footer' | 'children' | 'header'> & {
    footer?: string;
    children: string;
    header: string;
  };
</script>

{#snippet template({ children, ...args }: Args, context: StoryContext<typeof Layout>)}
  <Layout {...args}>
    {#snippet header()}
      {args.header}
    {/snippet}
    {children}
    {#snippet footer()}
      {args.footer}
    {/snippet}
  </Layout>
{/snippet}

<Story name="Default" />

<Story name="With mainFontSize" args={{ mainFontSize: 'small' }} />

<Story name="With Header string" args={{ header: 'Header' }} />

<Story name="With Header and Footer snippet" args={{ mainFontSize: 'small' }}>
  {#snippet template({ children, ...args })}
    <Layout {...args}>
      {#snippet header()}
        This is a header
      {/snippet}
      {children}
      {#snippet footer()}
        This is a footer
      {/snippet}
    </Layout>
  {/snippet}
</Story>
