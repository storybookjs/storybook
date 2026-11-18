<script module>
  import { defineMeta as d } from '@storybook/svelte';
  import { expect } from 'storybook/test';

  /**
   * Svelte CSF still works when its identifiers are renamed.
   */
  const { Story: S } = d({
    parameters: {
      chromatic: { disableSnapshot: true },
      actions: { disable: true },
      controls: { disable: true },
    },
  });
</script>

<S
  name="Default"
  play={async (context) => {
    const { canvas } = context;
    const p = canvas.getByTestId('test');

    expect(p).toBeInTheDocument();
  }}
>
  <p data-testid="test">
    You can override
    <strong>the following identifiers name</strong> that Svelte CSF uses:
  </p>

  <ul>
    <li>
      <code>imported `defineMeta` function</code>
    </li>

    <li>
      <code> destructured `Story` from `defineMeta` (or whatever you renamed it to) call </code>
    </li>

    <li>
      <code> destructured `meta` from `defineMeta` (or whatever you renamed it to) call </code>
    </li>
  </ul>
</S>
