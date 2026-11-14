import { describe, expect, it, vi } from 'vitest';

import { join } from 'pathe';

import { noStorybookProjectMessage } from './vitest-manager.ts';

vi.mock('vitest/node', () => ({}));

const cwd = process.cwd();
const configDir = join(cwd, '.storybook');
const projectName = `storybook:${configDir}`;

describe('noStorybookProjectMessage', () => {
  it('says where it looked, what it found and how to add the plugin', () => {
    expect(
      noStorybookProjectMessage({
        configDir,
        projectName,
        found: {
          explicit: false,
          searched: [cwd, configDir],
          others: [join(cwd, 'vitest.config.ts')],
        },
        loaded: join(cwd, 'vitest.config.ts'),
      })
    ).toBe(
      [
        `Vitest has no project for the Storybook in \`.storybook\`: Storybook runs the Vitest project \`${projectName}\`, which the \`storybookTest\` plugin of \`@storybook/addon-vitest/vitest-plugin\` adds.`,
        '',
        'Storybook looked for a Vite or Vitest config (vitest.config.*, vite.config.*, vitest.*.config.*, vite.*.config.*) that uses the plugin for this Storybook in `.`, `.storybook`, and found none; `vitest.config.ts` does not use it for this Storybook. Vitest loaded `vitest.config.ts`.',
        '',
        "To run story tests, add `storybookTest({ configDir: '.storybook' })` to the plugins of a Vitest project in one of those configs, or run `npx storybook add @storybook/addon-vitest --yes` to set it up. A config that reaches the plugin only through another file it imports is not recognised: put the config that uses the plugin in one of those places.",
      ].join('\n')
    );
  });

  it('names the config Vitest loads instead of the one with the plugin', () => {
    expect(
      noStorybookProjectMessage({
        configDir,
        projectName,
        found: {
          configFile: join(cwd, 'vite.config.ts'),
          root: cwd,
          explicit: false,
          loads: join(cwd, 'vitest.config.ts'),
          searched: [cwd],
          others: [],
        },
        loaded: join(cwd, 'vitest.config.ts'),
      })
    ).toContain(
      '`vite.config.ts` uses the plugin, but Vitest loads `vitest.config.ts` from that folder, which has no project for this Storybook.'
    );
  });

  it('points at the configDir option when the loaded config uses the plugin', () => {
    expect(
      noStorybookProjectMessage({
        configDir,
        projectName,
        found: {
          configFile: join(configDir, 'vitest.config.ts'),
          root: cwd,
          explicit: true,
          loads: join(configDir, 'vitest.config.ts'),
          searched: [cwd, configDir],
          others: [],
        },
        loaded: join(configDir, 'vitest.config.ts'),
      })
    ).toContain("Check that the plugin's `configDir` option points at `.storybook`.");
  });
});
