// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import type { IndexEntry } from 'storybook/internal/types';

import { join } from 'pathe';
import { dedent } from 'ts-dedent';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { createDocgenProvider, createSummaryProvider } from './docgen-worker.ts';

const csf = (imports: string, component: string) => dedent`
  ${imports}
  export default { component: ${component} };
  export const Primary = {};
`;

const svelteCsf = (imports: string, component: string) => dedent`
  <script module>
    import { defineMeta } from '@storybook/svelte';
    ${imports}
    const { Story } = defineMeta({ component: ${component} });
  </script>

  <Story name="Primary" />
`;

const files = {
  'Button.svelte': dedent`
    <!--
    @component
    A button for the main action in a view.

    @summary for user actions
    -->
    <script lang="ts">
      let { label }: { label: string } = $props();
    </script>

    <button>{label}</button>
  `,
  'Plain.svelte': dedent`
    <script>
      let { label } = $props();
    </script>

    <span>{label}</span>
  `,
  'Card.svelte': dedent`
    <script lang="ts">
      let { title }: { title: string } = $props();
    </script>

    <!-- @component A card that groups related content. -->
    <section>{title}</section>

    <style lang="scss">
      $gap: 1rem;
      section {
        padding: $gap;
      }
    </style>
  `,
  'Alert.svelte': dedent`
    <!--
    @component
    Shown only where the describe tag is not read.
    @describe An alert that interrupts the user.
    -->
    <div role="alert"></div>
  `,
  'Broken.svelte': dedent`
    <!-- @component A component with a block left open. -->
    {#if open}
      <p>Open</p>
  `,
  'barrel.ts': `export { default as Tooltip } from './Card.svelte';`,
  'Button.stories.ts': csf(`import Button from './Button.svelte';`, 'Button'),
  'Plain.stories.ts': csf(`import Plain from './Plain.svelte';`, 'Plain'),
  'Card.stories.svelte': svelteCsf(`import Card from './Card.svelte';`, 'Card'),
  'Alert.stories.svelte': svelteCsf(`import Alert from './Alert.svelte';`, 'Alert'),
  'Tooltip.stories.ts': csf(`import { Tooltip as Hint } from './barrel';`, 'Hint'),
  'Hook.stories.ts': dedent`
    export default { title: 'Hooks/use Thing' };
    export const Primary = {};
  `,
  'Missing.stories.ts': csf(`import Missing from './Missing.svelte';`, 'Missing'),
  'Broken.stories.ts': csf(`import Broken from './Broken.svelte';`, 'Broken'),
};

const stories = [
  'Button.stories.ts',
  'Plain.stories.ts',
  'Card.stories.svelte',
  'Alert.stories.svelte',
  'Tooltip.stories.ts',
  'Hook.stories.ts',
  'Missing.stories.ts',
  'Broken.stories.ts',
  'Button.svelte',
];

let root: string;

// Real files: oxc-resolver and TypeScript read the disk through their own `fs`.
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'svelte-docgen-summary-'));
  for (const [path, content] of Object.entries(files)) {
    writeFileSync(join(root, path), content);
  }
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

const entryFor = (file: string): IndexEntry => ({
  type: 'story',
  subtype: 'story',
  id: `${file.split('.')[0].toLowerCase()}--primary`,
  name: 'Primary',
  title: `Kit/The ${file.split('.')[0]}`,
  importPath: join(root, file),
});

it.each(stories)('summarizes %s as docgen names and describes it', async (file) => {
  const entry = entryFor(file);
  // A docgen provider of its own: the engine fails every component of a project once it has read
  // one that svelte2tsx cannot compile, such as Broken.svelte.
  const docgen = await createDocgenProvider()(async () => undefined)({ entry });
  const [summary] = await createSummaryProvider()([{ entry }]);

  expect(summary).toEqual(
    docgen && { name: docgen.name, description: docgen.description, summary: docgen.summary }
  );
});

it('describes the cases above, so the comparison is not of nothing to nothing', async () => {
  const summaries = await createSummaryProvider()(
    stories.map((file) => ({ entry: entryFor(file) }))
  );

  expect(summaries).toEqual([
    {
      name: 'Button',
      description: 'A button for the main action in a view.',
      summary: 'for user actions',
    },
    { name: 'Plain' },
    {
      name: 'Card',
      description: 'A card that groups related content.',
    },
    {
      name: 'Alert',
      description: 'An alert that interrupts the user.',
    },
    {
      name: 'Hint',
      description: 'A card that groups related content.',
    },
    undefined,
    { name: 'The Missing' },
    { name: 'The Broken' },
    undefined,
  ]);
});
