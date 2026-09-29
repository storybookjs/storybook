import * as fsp from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatFileContent } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { csfNextMockedArgs, transformCsfNextMockedArgs } from './csf-next-mocked-args.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const storyPath = '/project/src/Button.stories.ts';
const packageManager = {} as JsPackageManager;
const mainConfig = {} as StorybookConfigRaw;

const csfNextStory = dedent`
  import { fn } from 'storybook/test';

  import preview from '#.storybook/preview';

  import { Button } from './Button';

  const meta = preview.meta({ component: Button, args: { onClick: fn() } });

  export const Primary = meta.story({
    play: async ({ args }) => {
      args.onClick.mockClear();
    },
  });
`;

const check = (options: { beforeVersion?: string; requested?: boolean }) =>
  csfNextMockedArgs.check({
    packageManager,
    mainConfig,
    storybookVersion: '11.0.0',
    storiesPaths: [storyPath],
    ...options,
  });

beforeEach(() => {
  vol.reset();
  vi.mocked(formatFileContent).mockImplementation(async (_path, source) => source);
  vi.mocked(fsp.readFile).mockImplementation(vol.promises.readFile as typeof fsp.readFile);
  vi.mocked(fsp.writeFile).mockImplementation(vol.promises.writeFile as typeof fsp.writeFile);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('transformCsfNextMockedArgs', () => {
  it('wraps mock API calls on args in mocked()', () => {
    expect(transformCsfNextMockedArgs(csfNextStory)).toMatchInlineSnapshot(`
      "import { fn, mocked } from 'storybook/test';

      import preview from '#.storybook/preview';

      import { Button } from './Button';

      const meta = preview.meta({ component: Button, args: { onClick: fn() } });

      export const Primary = meta.story({
        play: async ({ args }) => {
          mocked(args.onClick).mockClear();
        },
      });"
    `);
  });

  it('leaves CSF 3 stories and CSF Next stories without mock calls unchanged', () => {
    const csf3 = dedent`
      export default { component: Button };
      export const Primary = { play: async ({ args }) => args.onClick.mockClear() };
    `;
    const withoutMocks = csfNextStory.replace('args.onClick.mockClear();', '');

    expect(transformCsfNextMockedArgs(csf3)).toBe(csf3);
    expect(transformCsfNextMockedArgs(withoutMocks)).toBe(withoutMocks);
    expect(transformCsfNextMockedArgs('const meta = broken.meta(')).toBe(
      'const meta = broken.meta('
    );
  });
});

describe('csfNextMockedArgs', () => {
  it('runs when upgrading to Storybook 11 or when requested', async () => {
    vol.fromJSON({ [storyPath]: csfNextStory });

    expect(await check({ beforeVersion: '10.3.0' })).toMatchObject({
      files: [{ path: storyPath }],
    });
    expect(await check({ requested: true })).toMatchObject({ files: [{ path: storyPath }] });
    expect(await check({ beforeVersion: '11.0.0-alpha.2' })).toBeNull();
    expect(await check({})).toBeNull();
  });

  it('writes the transformed stories unless it is a dry run', async () => {
    vol.fromJSON({ [storyPath]: csfNextStory });
    const result = (await check({ requested: true }))!;
    const run = (dryRun: boolean) =>
      csfNextMockedArgs.run!({
        packageManager,
        result,
        dryRun,
        mainConfigPath: '/project/.storybook/main.ts',
        mainConfig,
        configDir: '/project/.storybook',
        storybookVersion: '11.0.0',
        storiesPaths: [storyPath],
      });

    await run(true);
    expect(vol.readFileSync(storyPath, 'utf8')).toBe(csfNextStory);

    await run(false);
    expect(vol.readFileSync(storyPath, 'utf8')).toContain('mocked(args.onClick).mockClear();');
  });
});
