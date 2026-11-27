import { existsSync } from 'node:fs';
import { posix, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { syncStorybookAddons } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

import { runCodemod } from '../automigrate/codemod.ts';
import { SANDBOX_STORIES_GLOB, csfFactories, storyToCsf4 } from './csf-factories.ts';

vi.mock('node:fs', { spy: true });
vi.mock('../automigrate/codemod.ts', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

const options = { previewConfigPath: '#.storybook/preview', useSubPathImports: true };
const path = 'Button.stories.tsx';

it('lifts a CSF 2 story to CSF 3 before writing the factory', async () => {
  const output = await storyToCsf4(
    {
      path,
      source: dedent`
        export default { component: Button };
        const Template = (args) => <Button {...args} />;
        export const Primary = Template.bind({});
        Primary.args = { label: 'Button' };
      `,
    },
    options
  );

  expect(output).toContain('export const Primary = meta.story({');
  expect(output).not.toContain('Template.bind');
});

it.each([
  [
    'a CSF 3 meta',
    dedent`
      import type { ComponentMeta, StoryObj } from '@storybook/react';
      import { Button, type ButtonType } from './Button';
      const meta: ComponentMeta<ButtonType> = { component: Button };
      export default meta;
      export const Primary: StoryObj = { args: { label: 'Button' } };
    `,
  ],
  [
    'a CSF 3 story',
    dedent`
      import type { ComponentStoryObj } from '@storybook/react';
      import { Button, type ButtonType } from './Button';
      export default { component: Button };
      export const Primary: ComponentStoryObj<ButtonType> = { args: { label: 'Button' } };
    `,
  ],
  [
    'CSF 2 stories',
    dedent`
      import type { ComponentMeta, ComponentStory } from '@storybook/react';
      import { Button, type ButtonType } from './Button';
      export default { component: Button } as ComponentMeta<ButtonType>;
      const Template: ComponentStory<ButtonType> = (args) => <Button {...args} />;
      export const Primary: ComponentStory<ButtonType> = Template.bind({});
      Primary.args = { label: 'Button' };
    `,
  ],
])('does not treat the component type of %s as args', async (_, source) => {
  const output = await storyToCsf4({ path, source }, options);

  expect(output).toContain('const meta = preview.meta({ component: Button });');
  expect(output).not.toContain('.type<');
  expect(output).not.toContain('@storybook/react');
});

it('keeps an aliased Storybook type that a helper still uses', async () => {
  const output = await storyToCsf4(
    {
      path,
      source: dedent`
        import type { ComponentStoryObj as LegacyStory } from '@storybook/react';
        import { Button } from './Button';
        export default { component: Button };
        const helper: LegacyStory<typeof Button> = { args: { label: 'Button' } };
        export const Primary = { args: helper.args };
      `,
    },
    options
  );

  expect(output).toContain('ComponentStoryObj as LegacyStory');
});

it('leaves a file untouched when the factory skips it', async () => {
  const source = dedent`
    import type { StoryFn } from '@storybook/react';
    import { Button } from './Button';
    export default { component: Button };
    const Template: StoryFn = (args) => <Button {...args} />;
    export const Primary: StoryFn = Template.bind({});
    Primary.args = { label: 'Button' };
    export const Secondary = function (args) {
      return <Button {...args} />;
    };
  `;

  await expect(storyToCsf4({ path, source }, options)).resolves.toBe(source);
});

it('keeps the annotations of a story behind the bindings they read', async () => {
  const output = await storyToCsf4(
    {
      path,
      source: dedent`
        export default { component: Button };
        export const Primary = (args) => <Button {...args} />;
        const label = 'Button';
        Primary.args = { label };
      `,
    },
    options
  );

  expect(output.indexOf("const label = 'Button'")).toBeGreaterThan(-1);
  expect(output.indexOf('{ label }')).toBeGreaterThan(output.indexOf("const label = 'Button'"));
});

it('keeps a render function that overrides the render of the meta', async () => {
  const output = await storyToCsf4(
    {
      path,
      source: dedent`
        export default {
          component: Button,
          render: (args) => <div><Button {...args} /></div>,
        };
        export const Unwrapped = (args) => <Button {...args} />;
      `,
    },
    options
  );

  expect(output).toContain('export const Unwrapped = meta.story(');
  expect(output).not.toContain('export const Unwrapped = meta.story()');
});

it('still writes the factory of a story csf-2-to-3 refuses', async () => {
  const output = await storyToCsf4(
    {
      path,
      source: dedent`
        import * as SB from '@storybook/react-vite';
        export default { component: Button };
        export const Primary: SB.StoryObj = { args: { label: 'Button' } };
      `,
    },
    options
  );

  expect(output).toContain('export const Primary = meta.story({');
});

it.each([
  'stories/Button.stories.ts',
  'stories/header.stories.js',
  'src/stories/Page.stories.tsx',
  'src/stories/Button.stories.svelte',
])('matches the starter story %s in a sandbox', (file) => {
  expect(posix.matchesGlob(file, SANDBOX_STORIES_GLOB)).toBe(true);
});

it.each([
  'src/stories/frameworks/angular/signal/button.stories.ts',
  'stories/renderers/react/Button.stories.tsx',
  'src/app/button.stories.ts',
  'src/Button.stories.ts',
])('does not match %s in a sandbox', (file) => {
  expect(posix.matchesGlob(file, SANDBOX_STORIES_GLOB)).toBe(false);
});

const projectDir = resolve('/project');
const sources = new Map<string, string>();
const written = new Map<string, string>();

beforeEach(() => {
  vi.stubEnv('IN_STORYBOOK_SANDBOX', 'false');
  sources.clear();
  written.clear();
  vi.mocked(syncStorybookAddons).mockResolvedValue(undefined);
  vi.mocked(runCodemod).mockImplementation(async (globOrFiles = [], transform) => {
    const files = [globOrFiles].flat();
    for (const file of files) {
      const source = sources.get(file);
      if (source !== undefined) {
        written.set(file, await transform({ path: file, source }));
      }
    }
    return { files, errorCount: 0 };
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function migrateProject(
  configFolder: string,
  {
    storyFiles = ['stories/Button.stories.tsx'],
    glob,
  }: { storyFiles?: string[]; glob?: string } = {}
) {
  const configDir = resolve(projectDir, configFolder);
  const paths = {
    main: resolve(configDir, 'main.ts'),
    preview: resolve(configDir, 'preview.tsx'),
    story: resolve(configDir, 'stories/Button.stories.tsx'),
  };
  sources.set(
    paths.main,
    dedent`
      const main = { stories: ['./stories/**/*.stories.?(ts|tsx|js|jsx)'] };
      export default main;
    `
  );
  sources.set(
    paths.preview,
    dedent`
      const preview = {};
      export default preview;
    `
  );
  sources.set(
    paths.story,
    dedent`
      import { Button } from './Button';
      const meta = { component: Button };
      export default meta;
      export const Primary = { args: { title: 'Button' } };
    `
  );

  await csfFactories.run({
    configDir,
    mainConfigPath: paths.main,
    previewConfigPath: paths.preview,
    mainConfig: { stories: ['./stories/**/*.stories.?(ts|tsx|js|jsx)'] },
    storiesPaths: storyFiles.map((file) => resolve(configDir, file)),
    packageManager: {
      primaryPackageJson: {
        packageJson: {},
        operationDir: projectDir,
        packageJsonPath: resolve(projectDir, 'package.json'),
      },
      writePackageJson: vi.fn(),
    } as unknown as JsPackageManager,
    result: null,
    storybookVersion: '11.0.0',
    yes: true,
    glob,
  });

  return { paths, written };
}

describe('a .rnstorybook config without a framework', () => {
  it('migrates the story files of the main config without its MDX files', async () => {
    const { paths, written } = await migrateProject('.rnstorybook', {
      storyFiles: ['stories/Button.stories.tsx', 'Introduction.mdx'],
    });

    expect(vi.mocked(runCodemod).mock.calls[0][0]).toEqual([paths.story]);
    expect(written.get(paths.story)).toContain("import preview from '#.storybook/preview';");
  });

  it('imports the factories from @storybook/react-native', async () => {
    const { paths, written } = await migrateProject('.rnstorybook');

    expect(written.get(paths.main)).toMatch(
      /import { defineMain } from ['"]@storybook\/react-native\/node['"]/
    );
    expect(written.get(paths.preview)).toMatch(
      /import { definePreview } from ['"]@storybook\/react-native['"]/
    );
  });
});

it('skips the stories but migrates main and preview when the main config only has MDX files', async () => {
  const { paths, written } = await migrateProject('.storybook', {
    storyFiles: ['Introduction.mdx'],
  });

  expect(vi.mocked(runCodemod).mock.calls.map(([files]) => files)).toEqual([
    [paths.main],
    [paths.preview],
  ]);
  expect(written.get(paths.main)).toContain('defineMain');
  expect(written.get(paths.preview)).toContain('definePreview');
});

it('skips the story files of the main config inside node_modules', async () => {
  const { paths } = await migrateProject('.storybook', {
    storyFiles: ['stories/Button.stories.tsx', 'node_modules/ui/Card.stories.tsx'],
  });

  expect(vi.mocked(runCodemod).mock.calls[0][0]).toEqual([paths.story]);
});

it('migrates a story once when overlapping stories entries both match it', async () => {
  const { paths } = await migrateProject('.storybook', {
    storyFiles: ['stories/Button.stories.tsx', 'stories/Button.stories.tsx'],
  });

  expect(vi.mocked(runCodemod).mock.calls[0][0]).toEqual([paths.story]);
});

it.each(['false', 'true'])(
  'migrates the files of --glob when IN_STORYBOOK_SANDBOX is %s',
  async (inSandbox) => {
    vi.stubEnv('IN_STORYBOOK_SANDBOX', inSandbox);

    await migrateProject('.storybook', { glob: 'src/**/*.stories.tsx' });

    expect(vi.mocked(runCodemod).mock.calls[0][0]).toBe('src/**/*.stories.tsx');
  }
);

describe('in a sandbox', () => {
  beforeEach(() => {
    vi.stubEnv('IN_STORYBOOK_SANDBOX', 'true');
  });

  it('migrates only the starter stories', async () => {
    await migrateProject('.storybook');

    expect(vi.mocked(runCodemod).mock.calls[0][0]).toBe(SANDBOX_STORIES_GLOB);
  });
});

describe('a .storybook config without a framework next to a .rnstorybook folder', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockImplementation(
      (file) => resolve(String(file)) === resolve(projectDir, '.rnstorybook')
    );
  });

  afterEach(() => {
    vi.mocked(existsSync).mockReset();
  });

  it('keeps the placeholder framework', async () => {
    const { paths, written } = await migrateProject('.storybook');

    expect(written.get(paths.main)).toMatch(
      /import { defineMain } from ['"]@storybook\/your-framework-here\/node['"]/
    );
    expect(written.get(paths.preview)).toMatch(
      /import { definePreview } from ['"]@storybook\/your-framework-here['"]/
    );
  });
});

it('logs Windows preview and package.json paths with forward slashes', async () => {
  vi.stubEnv('IN_STORYBOOK_SANDBOX', '');
  vi.mocked(prompt.select).mockResolvedValue(true);
  vi.mocked(runCodemod).mockResolvedValue({ files: [], errorCount: 0 });
  vi.mocked(syncStorybookAddons).mockResolvedValue(undefined);
  const logBox = vi.mocked(logger.logBox).mockImplementation(() => {});
  const step = vi.mocked(logger.step).mockImplementation(() => {});

  await csfFactories.run({
    dryRun: true,
    yes: false,
    glob: '**/*.stories.tsx',
    mainConfig: {} as any,
    mainConfigPath: '.storybook\\main.ts',
    previewConfigPath: '.storybook\\preview.tsx',
    configDir: '.storybook',
    packageManager: {
      primaryPackageJson: {
        packageJson: {},
        operationDir: 'C:\\project',
        packageJsonPath: 'C:\\project\\package.json',
      },
      writePackageJson: vi.fn(),
    } as any,
  } as any);

  expect(logBox.mock.calls[0][0]).toContain('.storybook/preview.tsx');
  expect(step.mock.calls.map(([message]) => message)).toContainEqual(
    expect.stringContaining('C:/project/package.json')
  );
});
