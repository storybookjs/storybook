<script lang="ts" module>
  import { defineMeta, type StoryContext } from '@storybook/addon-svelte-csf';
  import Layout from './components/Layout.svelte';
  import type { ComponentProps } from 'svelte';
  import type { Merge } from 'type-fest';
  const { Story } = defineMeta({
    component: Layout,
    // @ts-expect-error TS does not understand that the snippet is defined before this call
    render: template,
    args: {
      mainFontSize: 'large',
      header: 'default header',
    },
    argTypes: {
      footer: {
        control: 'text',
      },
      children: {
        control: 'text',
      },
      header: {
        control: 'text',
      },
    },
  });

  type Args = Omit<ComponentProps<typeof Layout>, 'footer' | 'children' | 'header'> & {
    footer?: string;
    children: string;
    header: string;
  };

  // OR use the Merge helper from the 'type-fest' package:
  type SimplerArgs = Merge<
    ComponentProps<typeof Layout>,
    {
      footer?: string;
      children: string;
      header: string;
    }
  >;
</script>

{#snippet template({ children, ...args }: Args, context: StoryContext<Args>)}
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

<Story
  name="With all args"
  args={{
    mainFontSize: 'large',
    header: 'Header',
    footer: 'Footer',
    children: 'Children',
    emphasizeHeader: true,
  }}
/>

<Story name="With mainFontSize" args={{ mainFontSize: 'small' }} />

<Story name="With String Header" args={{ header: 'Header' }} />

<Story name="With static Header and Footer snippets">
  {#snippet template({ children, ...args }, context)}
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
