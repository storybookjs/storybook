<script module lang="ts">
  import { defineMeta, setTemplate, type Args } from '@storybook/addon-svelte-csf';
  import { expect, within } from '@storybook/test';

  /**
   * Demonstration on the **different ways of setting a template** for `<Story />` components within one stories file.
   */
  const { Story } = defineMeta({
    title: 'Templating',
    tags: ['autodocs'],
    argTypes: {
      text: { control: 'text' },
    },
  });
</script>

<script>
  /**
   * call setTemplate with a reference to any root-level snippet, for that snippet to be the fallback snippet,
   * that is used in any story without explicit template.
   */
  setTemplate(defaultTemplate);
</script>

{#snippet defaultTemplate(args: Args<typeof Story>)}
  <h2 data-testid="heading">Default template</h2>
  <p>{args?.text}</p>
{/snippet}

<!--
  The simplest story has a **static** template, which doesn't consume Storybook's `args`.
  These stories don't react to arg changes caused by changes in the Controls panel.

  Example:

  ```svelte
  <Story name="Static story">
    <p>Static template</p>
  </Story>
  ```
-->
<Story
  name="Static template"
  play={async (context) => {
    const { canvasElement } = context;
    const canvas = within(canvasElement);
    const h2 = await canvas.findByTestId('heading');
    expect(h2).toHaveTextContent('Static template');
  }}
>
  <h2 data-testid="heading">Static template</h2>
  <p>
    This story is static and isn't defined with a snippet. It will ignore any <code>args</code> changes
    because they are not passed in.
  </p>
</Story>

<!--
  Pass a `template` snippet to the story to make it dynamic and react to Storybook's `args` changes.
  The snippet takes two arguments, `args` and `context`.

  Example:

  ```svelte
  <Story name="Dynamic story">
    {#snippet template(args)}
      <SomeComponent {...args}>
        Dynamic template
      </SomeComponent>
    {/snippet}
  </Story>
  ```
-->
<Story
  name="Template snippet"
  args={{ text: 'This story uses a template snippet' }}
  play={async (context) => {
    const { args, canvasElement } = context;
    const canvas = within(canvasElement);
    const h2 = await canvas.findByTestId('heading');
    const p = await canvas.findByText(args.text);

    expect(h2).toBeInTheDocument();
    expect(p).toBeInTheDocument();
  }}
>
  {#snippet template(args)}
    <h2 data-testid="heading">Template snippet</h2>
    <p>{args?.text}</p>
  {/snippet}
</Story>

{#snippet sharedTemplate(args: Args<typeof Story>)}
  <h2 data-testid="heading">Shared template</h2>
  <p>{args?.text}</p>
{/snippet}

<!--
  If you want to share the template between multiple stories,
  you can define the snippet at the root and pass it in as the `template` **prop** to the `<Story>` component.

  Example:

  ```svelte
  {#snippet template(args: Args<typeof Story>)}
    <SomeComponent {...args}>
      My custom template to reuse across several stories
    </SomeComponent>
  {/snippet}

  <Story name="Explicit snippet" {template} />
  ```
-->
<Story
  name="Shared template"
  template={sharedTemplate}
  args={{
    text: 'This story uses a shared snippet, which is explicitly set as the `template` prop to the <Story> component',
  }}
  play={async (context) => {
    const { args, canvasElement } = context;
    const canvas = within(canvasElement);
    const h2 = await canvas.findByTestId('heading');
    const p = await canvas.findByText(args.text);

    expect(h2).toBeInTheDocument();
    expect(p).toBeInTheDocument();
  }}
/>

<!--
  To set a default template for all stories in the file, call the **`setTemplate()`** function with a reference to a root snippet.
  Any story without `template` will use this default template.

  Example:

  ```svelte
  <script>
    import { setTemplate, type Args } from '@storybook/addon-svelte-csf';
  </script>

  <script>
    setTemplate(defaultTemplate);
  </script>

  {#snippet defaultTemplate(args: Args<typeof Story>)}
    <SomeComponent {...args}>
      A default template to be used in <Story> components which doesn't have an explicit template set
    </SomeComponent>
  {/snippet}

  <Story name="Default" />
  ```
-->
<Story
  name="setTemplate"
  args={{
    text: 'This story is based on the snippet passed to the setTemplate() function',
  }}
  play={async (context) => {
    const { args, canvasElement } = context;
    const canvas = within(canvasElement);
    const h2 = await canvas.findByTestId('heading');
    const p = await canvas.findByText(args.text);

    expect(h2).toBeInTheDocument();
    expect(p).toBeInTheDocument();
  }}
/>
