<script module lang="ts">
  import { expect } from 'storybook/test';

  import preview from './preview.ts';
  import Button from '../../../template/stories/svelte-csf/button.svelte';

  const meta = preview.meta({ component: Button, args: { size: 'large' } });
  const { Story } = meta;
</script>

<script lang="ts">
  // A local `meta` must not clash with the meta of the stories file.
  let local = $state({ meta: 'local' });
</script>

<Story
  name="Primary"
  args={{ primary: true }}
  play={async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveClass('primary', 'large');
  }}
>
  Primary
</Story>

<!-- The export name is the same as the name of the imported component. -->
<Story
  name="Button"
  play={async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toHaveTextContent('local');
  }}
>
  {local.meta}
</Story>
