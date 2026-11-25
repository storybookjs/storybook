import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { posix } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { expect, it, onTestFinished, vi } from 'vitest';

import { type JsPackageManager, effects, syncStorybookAddons } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import { dirname, join } from 'pathe';
import { dedent } from 'ts-dedent';

import { runCodemod } from '../automigrate/codemod.ts';
import { SANDBOX_STORIES_GLOB, csfFactories, storyToCsf4 } from './csf-factories.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('../automigrate/codemod.ts', { spy: true });

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

it('changes no file in a dry run, and stages each file a run would write', async () => {
  const root = mkdtempSync(join(tmpdir(), 'storybook-csf-factories-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const mainConfig = {
    stories: ['../src/**/*.stories.js'],
    addons: ['my-addon'],
    framework: '@storybook/react-vite',
  };
  const files = {
    'package.json': JSON.stringify({ name: 'app' }),
    '.storybook/main.js': `export default ${JSON.stringify(mainConfig)};`,
    '.storybook/preview.js': 'export default {};',
    'src/Button.stories.js': dedent`
      export default { component: Button };
      export const Primary = { args: { label: 'Button' } };
    `,
    'node_modules/my-addon/package.json': JSON.stringify({
      name: 'my-addon',
      exports: { './preview': './preview.js' },
    }),
    'node_modules/my-addon/preview.js': 'export default {};',
  };
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  effects.setDryRun(true);
  onTestFinished(() => effects.setDryRun(false));
  vi.mocked(prompt.select).mockResolvedValue(true);

  await csfFactories.run({
    glob: join(root, 'src/**/*.stories.js'),
    mainConfig,
    mainConfigPath: join(root, '.storybook/main.js'),
    previewConfigPath: join(root, '.storybook/preview.js'),
    configDir: join(root, '.storybook'),
    packageManager: {
      primaryPackageJson: {
        packageJson: { name: 'app' },
        operationDir: root,
        packageJsonPath: join(root, 'package.json'),
      },
      writePackageJson: vi.fn(),
    } as unknown as JsPackageManager,
    result: null,
    storybookVersion: '11.0.0',
    storiesPaths: [join(root, 'src/Button.stories.js')],
  });

  for (const [file, content] of Object.entries(files)) {
    expect(readFileSync(join(root, file), 'utf-8')).toBe(content);
  }
  expect(effects.describeDryRunChanges().map((line) => stripVTControlCharacters(line))).toEqual([
    expect.stringMatching(/^update .*\/\.storybook\/main\.js$/),
    expect.stringMatching(/^update .*\/\.storybook\/preview\.js$/),
    expect.stringMatching(/^update .*\/src\/Button\.stories\.js$/),
  ]);
  // The addon sync reads the preview that the codemod staged, so it sees the factory.
  expect(await effects.readFile(join(root, '.storybook/preview.js'))).toMatch(
    /import \* as myAddon from ['"]my-addon\/preview['"]/
  );
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
  vi.unstubAllEnvs();
});
