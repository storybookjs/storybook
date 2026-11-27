import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile, JsPackageManager } from 'storybook/internal/common';

import { fs, vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { csfNextMockedArgs } from './csf-next-mocked-args.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const storyPath = resolve('src/Button.stories.ts');
const options = {
  packageManager: vi.mocked(JsPackageManager.prototype),
  mainConfig: { stories: [] },
  mainConfigPath: resolve('.storybook/main.ts'),
  configDir: resolve('.storybook'),
  storybookVersion: '11.0.0',
  storiesPaths: [storyPath],
};

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

const migrate = async (files: Record<string, string>) => {
  vol.fromJSON(files);
  const storiesPaths = Object.keys(files);
  const failures = await runFix(csfNextMockedArgs, { ...options, storiesPaths, result: {} });
  return {
    failures,
    files: Object.fromEntries(storiesPaths.map((path) => [path, fs.readFileSync(path, 'utf8')])),
  };
};

describe('csf-next-mocked-args', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(formatExistingFile).mockImplementation(async (_path, source) => source);
  });

  afterEach(() => {
    vi.mocked(readFile).mockRestore();
    vi.mocked(writeFile).mockRestore();
  });

  it('applies when upgrading to Storybook 11 or when requested', async () => {
    vol.fromJSON({ [storyPath]: csfNextStory });

    expect(await checkFix(csfNextMockedArgs, { ...options, beforeVersion: '10.3.0' })).toEqual({});
    expect(await checkFix(csfNextMockedArgs, { ...options, requested: true })).toEqual({});

    expect(
      await checkFix(csfNextMockedArgs, { ...options, beforeVersion: '11.0.0-alpha.2' })
    ).toBeNull();
    expect(await checkFix(csfNextMockedArgs, options)).toBeNull();
    expect(
      await checkFix(csfNextMockedArgs, { ...options, requested: true, storybookVersion: '10.3.0' })
    ).toBeNull();
  });

  it('applies only when a CSF Next story calls the mock API on args', async () => {
    const check = () => checkFix(csfNextMockedArgs, { ...options, requested: true });

    vol.fromJSON({ [storyPath]: csfNextStory.replace('args.onClick.mockClear();', '') });
    expect(await check()).toBeNull();

    fs.writeFileSync(
      storyPath,
      dedent`
        export default { component: Button };
        export const Primary = { play: async ({ args }) => args.onClick.mockClear() };
      `
    );
    expect(await check()).toBeNull();

    fs.writeFileSync(storyPath, csfNextStory);
    expect(await check()).toEqual({});
  });

  it('wraps mock API calls on args in mocked() and imports it', async () => {
    const { failures, files } = await migrate({ [storyPath]: csfNextStory });

    expect(failures).toEqual([]);
    expect(files[storyPath]).toMatchInlineSnapshot(`
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
    expect(formatExistingFile).toHaveBeenCalledWith(storyPath, expect.any(String));
  });

  it('only rewrites the stories that need it, and finds nothing left to do afterwards', async () => {
    const csf3Path = resolve('src/Header.stories.ts');
    const docsPath = resolve('src/Intro.mdx');
    const csf3Story = dedent`
      export default { component: Header };
      export const Primary = { play: async ({ args }) => args.onLogin.mockClear() };
    `;
    const docs = '# Mocking\n\nUse `args.onClick.mockClear()` in a play function.';

    const { failures, files } = await migrate({
      [storyPath]: csfNextStory,
      [csf3Path]: csf3Story,
      [docsPath]: docs,
    });

    expect(failures).toEqual([]);
    expect(files[storyPath]).toContain('mocked(args.onClick).mockClear();');
    expect(files[csf3Path]).toBe(csf3Story);
    expect(files[docsPath]).toBe(docs);
    expect(writeFile).toHaveBeenCalledTimes(1);

    expect(
      await checkFix(csfNextMockedArgs, {
        ...options,
        requested: true,
        storiesPaths: [storyPath, csf3Path, docsPath],
      })
    ).toBeNull();
  });
});
