<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, userEvent, within } from '@storybook/test';

  import Text from './Text.svelte';
  import BorderDecorator from './BorderDecorator.svelte';

  /**
   * **Documentation resource**: https://storybook.js.org/docs/writing-stories/decorators#wrap-stories-with-extra-markup
   */
  const { Story } = defineMeta({
    component: Text,
    tags: ['autodocs'],
    decorators: [
      /*
       * NOTE:
       * This one is the parental one,
       * it will wrap together all of the decorators defined in this stories file.
       */
      () => ({
        Component: BorderDecorator,
        props: { color: 'pink' },
      }),
    ],
  });
</script>

<!--
  Use `defineMeta({ decorators: [] })` to specify a **parental one**.

  > [!NOTE]
  > It will wrap together all of the decorators defined in this stories file.

  ```svelte
    const { Story } = defineMeta({
      decorators: [
        () => ({
          Component: BorderDecorator,
          props: { color: 'pink' },
        }),
      ],
    });
  ```
-->
<Story
  name="in defineMeta"
  args={{
    text: 'Text is inside `defineMeta({ decorators: [ /* ... */ ]})`',
  }}
  play={async (context) => {
    const { args, canvasElement } = context;
    const canvas = within(canvasElement);
    const element = canvas.getByText(args.text);

    expect(element).toBeInTheDocument();
    expect(element.parentNode.style.borderColor).toBe('pink');
  }}
/>

<!--
  Use `<Story decorators={[]}` to set a decorator **for this specific story only**.

  > [!NOTE]
  > It will be **nested as a children** to the parental one from `defineMeta({ decorators: [] })`.

  ```svelte
  <Story
    decorators={[
      () => ({
        Component: BorderDecorator,
        props: { color: 'blue', width: '75%' },
      }),
    ]}
  />
  ```
-->
<Story
  name="In Story"
  args={{ text: 'Text is inside `<Story decorators={[/* ... */]} >`' }}
  decorators={[
    () => ({
      Component: BorderDecorator,
      props: { color: 'blue' },
    }),
  ]}
  play={async (context) => {
    const { args, canvasElement } = context;
    const canvas = within(canvasElement);
    const element = canvas.getByText(args.text);

    expect(element).toBeInTheDocument();
    expect(element.parentNode.style.borderColor).toBe('blue');
    expect(element.parentNode.parentNode.style.borderColor).toBe('pink');
  }}
/>

<!--
  You can define multiple decorators in `<Story decorators={[]}` for this **specific story only**.

  > [!NOTE]
  > **The first decorator _(array element)_** is the most deeply nested one children.

  ```svelte
  <Story
    name="Multiple in Story"
    args={{ text: 'Text is inside `<Story decorators={[/* first one */]} >`' }}
    decorators={[
      // NOTE: First one decorator is the most deeply nested children
      () => ({ Component: BorderDecorator, props: { color: 'cyan' } }),
      () => ({ Component: BorderDecorator, props: { color: 'darkorchid' } }),
      // NOTE: The last one decorator wraps all of the above decorators
      () => ({ Component: BorderDecorator, props: { color: 'gold' } }),
    ]}
  />
  ```
-->
<Story
  name="Multiple in Story"
  args={{ text: 'Text is inside `<Story decorators={[/* first one */]} >`' }}
  decorators={[
    // NOTE: First one decorator is the most deeply nested children
    () => ({ Component: BorderDecorator, props: { color: 'cyan' } }),
    () => ({ Component: BorderDecorator, props: { color: 'darkorchid' } }),
    // NOTE: The last one decorator wraps all of the above decorators
    () => ({ Component: BorderDecorator, props: { color: 'gold' } }),
  ]}
  play={async (context) => {
    const { args, canvasElement } = context;
    const canvas = within(canvasElement);
    const element = canvas.getByText(args.text);

    expect(element).toBeInTheDocument();
    expect(element.parentNode.style.borderColor).toBe('cyan');
    expect(element.parentNode.parentNode.style.borderColor).toBe('darkorchid');
    expect(element.parentNode.parentNode.parentNode.style.borderColor).toBe('gold');
    expect(element.parentNode.parentNode.parentNode.parentNode.style.borderColor).toBe('pink');
  }}
/>
