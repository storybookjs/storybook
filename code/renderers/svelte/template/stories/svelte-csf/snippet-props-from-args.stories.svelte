<script lang="ts" module>
  import { defineMeta, type StoryContext } from '@storybook/svelte';
  import type { ComponentProps } from 'svelte';
  import { expect } from 'storybook/test';

  import Layout from './layout.svelte';

  /**
   * `Layout` takes `header`, `children` and `footer` as snippets. These stories pass them as string
   * args, and a typed template turns them into snippets. svelte-check checks the types in this
   * file, and the play functions check what renders.
   */
  const { Story } = defineMeta({
    component: Layout,
    render: template,
    args: {
      mainFontSize: 'large',
      header: 'Header from meta',
    },
    argTypes: {
      footer: { control: 'text' },
      children: { control: 'text' },
      header: { control: 'text' },
    },
    parameters: {
      chromatic: { disableSnapshot: true },
    },
  });

  type Args = Omit<ComponentProps<typeof Layout>, 'footer' | 'children' | 'header'> & {
    footer?: string;
    children: string;
    header: string;
  };
</script>

{#snippet template({ children, ...args }: Args, _context: StoryContext<Args>)}
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

<Story
  name="Meta args"
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Header from meta')).toBeInTheDocument();
  }}
/>

<Story
  name="Story args"
  args={{
    mainFontSize: 'small',
    header: 'Header from story',
    footer: 'Footer from story',
    children: 'Children from story',
    emphasizeHeader: true,
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Header from story')).toBeInTheDocument();
    await expect(canvas.getByText('Footer from story')).toBeInTheDocument();
    await expect(canvas.getByText('Children from story')).toBeInTheDocument();
  }}
/>

<Story
  name="Inline template"
  play={async ({ canvas }) => {
    await expect(canvas.getByText('Header from the inline template')).toBeInTheDocument();
    await expect(canvas.getByText('Footer from the inline template')).toBeInTheDocument();
  }}
>
  {#snippet template({ children, ...args }, _context)}
    <Layout {...args}>
      {#snippet header()}
        Header from the inline template
      {/snippet}
      {children}
      {#snippet footer()}
        Footer from the inline template
      {/snippet}
    </Layout>
  {/snippet}
</Story>
