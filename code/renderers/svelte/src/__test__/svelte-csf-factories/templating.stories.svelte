<script module lang="ts">
  import { expect } from 'storybook/test';

  import preview from './preview.ts';

  /** Each story sets its template in a different way. */
  const { Story } = preview.meta({
    tags: ['autodocs'],
    argTypes: {
      text: { control: 'text' },
    },
    render: defaultTemplate,
  });
</script>

{#snippet defaultTemplate(args: { text: string })}
  <h2 data-testid="heading">Default template</h2>
  <p>{args?.text}</p>
{/snippet}

<Story
  name="Static template"
  asChild
  play={async ({ canvas }) => {
    await expect(await canvas.findByTestId('heading')).toHaveTextContent('Static template');
  }}
>
  <h2 data-testid="heading">Static template</h2>
</Story>

<Story
  name="Template snippet"
  args={{ text: 'This story uses a template snippet' }}
  play={async ({ args, canvas }) => {
    await expect(await canvas.findByTestId('heading')).toHaveTextContent('Template snippet');
    await expect(await canvas.findByText(args.text)).toBeInTheDocument();
  }}
>
  {#snippet template(args)}
    <h2 data-testid="heading">Template snippet</h2>
    <p>{args?.text}</p>
  {/snippet}
</Story>

{#snippet sharedTemplate(args: { text: string })}
  <h2 data-testid="heading">Shared template</h2>
  <p>{args?.text}</p>
{/snippet}

<Story
  name="Shared template"
  template={sharedTemplate}
  args={{ text: 'This story uses a shared snippet' }}
  play={async ({ args, canvas }) => {
    await expect(await canvas.findByTestId('heading')).toHaveTextContent('Shared template');
    await expect(await canvas.findByText(args.text)).toBeInTheDocument();
  }}
/>

<Story
  name="Default template"
  args={{ text: 'This story uses the render snippet of the meta' }}
  play={async ({ args, canvas }) => {
    await expect(await canvas.findByTestId('heading')).toHaveTextContent('Default template');
    await expect(await canvas.findByText(args.text)).toBeInTheDocument();
  }}
/>
