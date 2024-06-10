<script context="module" lang="ts">
  import { defineMeta, setTemplate, type Args } from '@storybook/addon-svelte-csf';
  import { expect, within } from '@storybook/test';

  /**
   * Demonstration on how to use **different ways of setting a template** for `<Story />` components within one stories file.
   */
  const { Story } = defineMeta({
    title: 'Templating',
    tags: ['autodocs'],
    args: { text: '' },
    argsTypes: {
      text: { control: 'text' },
    },
    parameters: {
      actions: { disable: true },
      controls: { disable: true },
    },
  });
</script>

<script>
  setTemplate(defaultTemplate);
</script>

{#snippet defaultTemplate(args: Args<typeof Story>)}
  <h2 data-testid="heading" style="color: fuchsia">Default template</h2>
  <hr />
  <p>{args?.text}</p>
{/snippet}

<!--
  Use this addon's featured **`setTemplate`** function to set a specific Svelte snippet at the root of fragment.
  It will be used as a template for every Story without **explicitly set template**.

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
      {"A default template to be used in `<Story>` components which doesn't have explicit template set"}
    </SomeComponent>
  {/snippet}

  <Story name="Default" />
  ```
-->
<Story
  name="Use setTemplate"
  args={{ text: 'This story uses a template from a snippet passed down to `setTemplate`' }}
  play={async (context) => {
    const { args, canvasElement } = context;
    const canvas = within(canvasElement);
    const h2 = await canvas.findByTestId('heading');
    const p = await canvas.findByText(args.text);

    expect(h2).toBeInTheDocument();
    expect(p).toBeInTheDocument();
    expect(h2.style.color).toBe('fuchsia');
  }}
/>

{#snippet customReusableTemplate(args: Args<typeof Story>)}
  <h2 data-testid="heading" style="color: lightgreen">Custom reusable template</h2>
  <p>{args?.text}</p>
{/snippet}

<!--
  Use the new Svelte `v5` **Snippets** feature: https://svelte-5-preview.vercel.app/docs/snippets

  ... to explicitly set a template from a snippet at the root of fragment - as a `children` **prop** _(attribute)_ to the `<Story>` component.

  Example:

  ```svelte
  {#snippet template(args: Args<typeof Story>)}
    <SomeComponent {...args}>
      {"My custom template to reuse across several stories"}
    </SomeComponent>
  {/snippet}

  <Story name="Explicit snippet" children={template} />
  ```
-->
<Story
  name="Use explicit snippet as children"
  children={customReusableTemplate}
  args={{
    text: 'This story uses a snippet `customReusableTemplate` snippet, which is explicitly set as a `children` attribute (prop) to the `<Story>` component',
  }}
  play={async (context) => {
    const { args, canvasElement } = context;
    const canvas = within(canvasElement);
    const h2 = await canvas.findByTestId('heading');
    const p = await canvas.findByText(args.text);

    expect(h2).toBeInTheDocument();
    expect(p).toBeInTheDocument();
    expect(h2.style.color).toBe('lightgreen');
  }}
/>

<!--
  To define a custom template, with Storybook's `args`,
  you can use the new Svelte `v5` **Snippets** feature: https://svelte-5-preview.vercel.app/docs/snippets

  ... to explicitly set a template from a snippet at the root of fragment - as a `children` **node** to `<Story>` component.

  > [!NOTE]
  > It will override a default template svelte snippet set by `setTemplate`.

  Example:

  ```svelte
  <Story name="Custom template">
    {#snippet children(args)}
      <SomeComponent {...args}>
        {"Custom template as a children node"}
      </SomeComponent>
    {/snippet}
  </Story>
  ```
-->
<Story
  name="Custom template"
  args={{ text: 'This story uses custom template passed as children node' }}
  play={async (context) => {
    const { args, canvasElement } = context;
    const canvas = within(canvasElement);
    const h2 = await canvas.findByTestId('heading');
    const p = await canvas.findByText(args.text);

    expect(h2).toBeInTheDocument();
    expect(p).toBeInTheDocument();
    expect(h2.style.color).toBe('orange');
  }}
>
  {#snippet children(args)}
    <h2 data-testid="heading" style="color: orange; font-weight: 700;">Custom template</h2>
    <hr style="border-style: dashed" />
    <p>{args?.text}</p>
    <hr />
  {/snippet}
</Story>

<!--
  You can also define a **static** template, which doesn't consume Storybook's `args`.

  > [!NOTE]
  > It will override a default template svelte snippet set by `setTemplate`.

  Example:

  ```svelte
  <Story name="Static template">
    <p>{'Static template.'}</p>
  </Story>
  ```
-->
<Story
  name="Static template"
  play={async (context) => {
    const { canvasElement } = context;
    const canvas = within(canvasElement);
    const h2 = await canvas.findByTestId('heading');
    const p = await canvas.findByText('Static template');

    expect(h2).toBeInTheDocument();
    expect(p).toBeInTheDocument();
    expect(h2.style.color).toBe('aqua');
  }}
>
  <h2 data-testid="heading" style="color: aqua">Static template</h2>
  <hr />
  <p>{'Static template.'}</p>
</Story>
