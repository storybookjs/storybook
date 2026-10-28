import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { expect, it } from 'vitest';

import { isAddonA11yEnabled } from './addon-a11y.ts';
import { isAddonVitestEnabled } from './addon-vitest.ts';

it.each([
  { name: 'no addons', addons: [], expected: { a11y: false, vitest: false } },
  {
    name: 'package names',
    addons: ['@storybook/addon-a11y', { name: '@storybook/addon-vitest' }],
    expected: { a11y: true, vitest: true },
  },
  {
    name: 'legacy preset and resolved paths',
    addons: [
      '@storybook/addon-a11y/preset',
      '/project/node_modules/@storybook/addon-vitest/dist/node.js',
    ],
    expected: { a11y: true, vitest: true },
  },
  {
    name: 'other addons',
    addons: ['@storybook/addon-docs', './local-addon'],
    expected: { a11y: false, vitest: false },
  },
])('reads $name from main.addons without an instance', async ({ addons, expected }) => {
  const configDir = await mkdtemp(join(tmpdir(), 'sb-has-addon-'));
  await writeFile(
    join(configDir, 'main.mjs'),
    `export default { stories: [], addons: ${JSON.stringify(addons)} };`
  );
  const options = { configDir } as Parameters<typeof isAddonA11yEnabled>[0];

  expect({
    a11y: await isAddonA11yEnabled(options),
    vitest: await isAddonVitestEnabled(options),
  }).toEqual(expected);
});

it('is false when the main config cannot load', async () => {
  const options = { configDir: join(tmpdir(), 'sb-has-addon-missing') } as Parameters<
    typeof isAddonA11yEnabled
  >[0];

  expect(await isAddonA11yEnabled(options)).toBe(false);
});
