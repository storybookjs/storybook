import { posix, resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { syncStorybookAddons } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';

import { dedent } from 'ts-dedent';

import { runCodemod } from '../automigrate/codemod.ts';
import { SANDBOX_STORIES_GLOB, csfFactories, storyToCsf4 } from './csf-factories.ts';

vi.mock('../automigrate/codemod.ts', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

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

describe('React Native project', () => {
  const projectDir = resolve('/project');
  const configDir = resolve(projectDir, '.rnstorybook');
  const mainConfigPath = resolve(configDir, 'main.ts');
  const previewConfigPath = resolve(configDir, 'preview.tsx');
  const storyPath = resolve(configDir, 'stories/Button.stories.tsx');
  const sources: Record<string, string> = {
    [mainConfigPath]: dedent`
      import type { StorybookConfig } from '@storybook/react-native';
      const main: StorybookConfig = { stories: ['./stories/**/*.stories.?(ts|tsx|js|jsx)'] };
      export default main;
    `,
    [previewConfigPath]: dedent`
      import type { Preview } from '@storybook/react-native';
      const preview: Preview = {};
      export default preview;
    `,
    [storyPath]: dedent`
      import type { Meta, StoryObj } from '@storybook/react-native';
      import { Button } from './Button';
      const meta = { component: Button } satisfies Meta<typeof Button>;
      export default meta;
      export const Primary: StoryObj<typeof meta> = { args: { title: 'Button' } };
    `,
  };
  const written = new Map<string, string>();

  beforeEach(async () => {
    written.clear();
    vi.mocked(syncStorybookAddons).mockResolvedValue(undefined);
    vi.mocked(runCodemod).mockImplementation(async (globOrFiles = [], transform) => {
      const files = [globOrFiles].flat();
      for (const file of files) {
        written.set(file, await transform({ path: file, source: sources[file] }));
      }
      return { files, errorCount: 0 };
    });

    await csfFactories.run({
      configDir,
      mainConfigPath,
      previewConfigPath,
      mainConfig: { stories: ['./stories/**/*.stories.?(ts|tsx|js|jsx)'] },
      storiesPaths: [storyPath, resolve(configDir, 'Introduction.mdx')],
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
    });
  });

  it('migrates the story files of the main config inside the config folder', () => {
    expect(vi.mocked(runCodemod).mock.calls[0][0]).toEqual([storyPath]);
    expect(written.get(storyPath)).toContain("import preview from '#.storybook/preview';");
  });

  it('imports the factories from the React Native framework without a framework field', () => {
    expect(written.get(mainConfigPath)).toContain(
      "import { defineMain } from '@storybook/react-native/node';"
    );
    expect(written.get(previewConfigPath)).toContain(
      "import { definePreview } from '@storybook/react-native';"
    );
  });
});
