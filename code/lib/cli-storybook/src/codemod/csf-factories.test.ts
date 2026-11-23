import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { posix } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import { dirname, join } from 'pathe';
import { dedent } from 'ts-dedent';

import { SANDBOX_STORIES_GLOB, csfFactories, storyToCsf4 } from './csf-factories.ts';

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

describe('csfFactories', () => {
  let root: string;

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const mainConfig = {
    stories: ['../src/**/*.stories.js'],
    addons: ['my-addon'],
    framework: '@storybook/react-vite',
  };

  // A preview still in CSF 3, and one that is already a factory, as when the codemod runs a second
  // time. Neither has the annotations of the addon in the main config.
  const previews = {
    'a CSF 3 preview': 'export default {};',
    'a factory preview': dedent`
      import { definePreview } from '@storybook/react-vite';

      export default definePreview({});
    `,
  };

  const addonImport = /import \* as myAddon from ['"]my-addon\/preview['"]/;

  const createProject = (preview: string) => {
    root = mkdtempSync(join(tmpdir(), 'storybook-csf-factories-'));
    const files = {
      'package.json': JSON.stringify({ name: 'app' }),
      '.storybook/main.js': `export default ${JSON.stringify(mainConfig)};`,
      '.storybook/preview.js': preview,
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

    const packageManager = {
      primaryPackageJson: {
        packageJson: { name: 'app' },
        operationDir: root,
        packageJsonPath: join(root, 'package.json'),
      },
      writePackageJson: vi.fn(),
    };

    return { files, packageManager };
  };

  const readFiles = (files: Record<string, string>) =>
    Object.fromEntries(
      Object.keys(files).map((file) => [file, readFileSync(join(root, file), 'utf-8')])
    );

  const run = (
    packageManager: ReturnType<typeof createProject>['packageManager'],
    dryRun: boolean
  ) => {
    // The user picks subpath imports, which adds an imports map to package.json.
    vi.mocked(prompt.select).mockResolvedValue(true);
    return csfFactories.run({
      dryRun,
      glob: join(root, 'src/**/*.stories.js'),
      mainConfig,
      mainConfigPath: join(root, '.storybook/main.js'),
      previewConfigPath: join(root, '.storybook/preview.js'),
      configDir: join(root, '.storybook'),
      packageManager: packageManager as unknown as JsPackageManager,
      result: null,
      storybookVersion: '11.0.0',
      storiesPaths: [join(root, 'src/Button.stories.js')],
    });
  };

  describe.each(Object.entries(previews))('with %s', (_, preview) => {
    it('says once that it was a dry run, and that it checks the stories', async () => {
      const { packageManager } = createProject(preview);

      await run(packageManager, true);

      const output = [logger.step, logger.log]
        .flatMap((method) => vi.mocked(method).mock.calls.flat())
        .join('\n');
      expect(output).toContain('Checking how codemods would apply on your stories');
      expect(output).toContain('Checking how codemods would apply on your main config');
      expect(output).toContain('Checking how codemods would apply on your preview config');
      expect(output).not.toContain('Applying codemod');
      expect(output).not.toContain('This was a dry run');
      expect(output.match(/Dry run finished/g) ?? []).toHaveLength(1);
    });

    it('changes no file in a dry run', async () => {
      const { files, packageManager } = createProject(preview);

      await run(packageManager, true);

      expect(packageManager.writePackageJson).not.toHaveBeenCalled();
      expect(readFiles(files)).toEqual(files);
    });

    it('names the preview a run would write and the addons it would sync, in a dry run', async () => {
      const { packageManager } = createProject(preview);

      await run(packageManager, true);

      const output = vi.mocked(logger.log).mock.calls.flat().join('\n');
      expect(output).toMatch(/Would write to .*\.storybook\/preview\.js/);
      expect(output).toMatch(/Would sync addons from main config into .*: my-addon/);
      expect(output).not.toContain('definePreview(');
    });

    it('writes the imports map, the preview and the stories in a normal run', async () => {
      const { files, packageManager } = createProject(preview);

      await run(packageManager, false);

      expect(packageManager.writePackageJson).toHaveBeenCalledWith(
        expect.objectContaining({ imports: { '#*': expect.any(Array) } }),
        root
      );
      const output = readFiles(files);
      expect(output['.storybook/preview.js']).toContain('export default definePreview(');
      expect(output['.storybook/preview.js']).toMatch(addonImport);
      expect(output['src/Button.stories.js']).toContain('export const Primary = meta.story(');
    });
  });

  it('leaves a preview that needs no change as it is written', async () => {
    const preview = dedent`
      import { definePreview } from '@storybook/react-vite'
      import * as myAddon from 'my-addon/preview'

      export default definePreview({ addons: [myAddon] })
    `;
    const { packageManager } = createProject(preview);
    // Formatting the preview would add semicolons.
    writeFileSync(join(root, '.prettierrc'), JSON.stringify({ semi: true }));

    await run(packageManager, false);

    expect(readFileSync(join(root, '.storybook/preview.js'), 'utf-8')).toBe(preview);
  });
});
