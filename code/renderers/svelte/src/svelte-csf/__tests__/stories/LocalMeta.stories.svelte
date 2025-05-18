<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { expect, within } from '@storybook/test';

  /**
   * Testing if there's no compile error when there's a user defined `meta` identifier.
   */
  const { Story } = defineMeta({
    parameters: {
      controls: { disable: true },
    },
  });
</script>

<script>
  let meta = $state({
    framework: 'svelte',
  });
  let output = $derived(JSON.stringify(meta, undefined, 2));
</script>

<Story
  name="LocalMeta"
  play={async (context) => {
    const { canvasElement } = context;
    const canvas = within(canvasElement);
    const pre = canvas.getByTestId('output');

    expect(pre.textContent).toEqual(output);
  }}
>
  <p>It works! 🎉</p>
  <pre data-testid="output">{output}</pre>
</Story>
