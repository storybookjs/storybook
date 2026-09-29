<script module>
  import { defineMeta as d } from '@storybook/addon-svelte-csf';
  import { expect, within } from 'storybook/test';

  /**
   * Testing if **overriding identifier names** of the addon important AST nodes does work.
   */
  const { Story: S } = d({
    title: 'Overrides',
    parameters: {
      actions: { disable: true },
      controls: { disable: true },
    },
  });
</script>

<S
  name="Default"
  play={async (context) => {
    const { canvasElement } = context;
    const canvas = within(canvasElement);
    const p = canvas.getByTestId('test');

    expect(p).toBeInTheDocument();
  }}
>
  <p data-testid="test">
    You can override
    <strong>the following identifiers name</strong> that belongs to this Storybook addon:
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
