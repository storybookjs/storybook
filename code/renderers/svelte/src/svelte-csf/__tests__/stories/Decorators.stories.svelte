<script context="module">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, userEvent, within } from '@storybook/test';

  import Text from './Text.svelte';
  import BackgroundDecorator from './BackgroundDecorator.svelte';

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
        Component: BackgroundDecorator,
        props: { color: 'lightpink', width: '100%' },
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
          Component: BackgroundDecorator,
          props: { color: 'lightpink', width: '100%' },
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
    expect(element.parentNode.style.backgroundColor).toBe('lightpink');
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
        Component: BackgroundDecorator,
        props: { color: 'lightblue', width: '75%' },
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
      Component: BackgroundDecorator,
      props: { color: 'lightblue', width: '75%' },
    }),
  ]}
  play={async (context) => {
    const { args, canvasElement } = context;
    const canvas = within(canvasElement);
    const element = canvas.getByText(args.text);

    expect(element).toBeInTheDocument();
    expect(element.parentNode.style.backgroundColor).toBe('lightblue');
    expect(element.parentNode.parentNode.style.backgroundColor).toBe('lightpink');
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
      () => ({ Component: BackgroundDecorator, props: { color: 'lightcyan', width: 'fit-content' } }),
      () => ({ Component: BackgroundDecorator, props: { color: 'darkorchid', width: '60ch' } }),
      // NOTE: The last one decorator wraps all of the above decorators
      () => ({ Component: BackgroundDecorator, props: { color: 'gold', width: '90%' } }),
    ]}
  />
  ```
-->
<Story
  name="Multiple in Story"
  args={{ text: 'Text is inside `<Story decorators={[/* first one */]} >`' }}
  decorators={[
    // NOTE: First one decorator is the most deeply nested children
    () => ({ Component: BackgroundDecorator, props: { color: 'lightcyan', width: 'fit-content' } }),
    () => ({ Component: BackgroundDecorator, props: { color: 'darkorchid', width: '60ch' } }),
    // NOTE: The last one decorator wraps all of the above decorators
    () => ({ Component: BackgroundDecorator, props: { color: 'gold', width: '90%' } }),
  ]}
  play={async (context) => {
    const { args, canvasElement } = context;
    const canvas = within(canvasElement);
    const element = canvas.getByText(args.text);

    expect(element).toBeInTheDocument();
    expect(element.parentNode.style.backgroundColor).toBe('lightcyan');
    expect(element.parentNode.parentNode.style.backgroundColor).toBe('darkorchid');
    expect(element.parentNode.parentNode.parentNode.style.backgroundColor).toBe('gold');
    expect(element.parentNode.parentNode.parentNode.parentNode.style.backgroundColor).toBe(
      'lightpink'
    );
  }}
/>
