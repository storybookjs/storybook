import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { migrate } from './migrate.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

const csf2Source = `import { Meta, Story } from '@storybook/react-vite'

import { Chart, ChartProps } from './chart'

export default {
  component: Chart,
  title: 'Chart',
} as Meta

const Template: Story<ChartProps> = (args) => <Chart {...args} />

export const SimpleBar = Template.bind({})
SimpleBar.args = { name: 'test' }
`;

describe('migrate', () => {
  const tempDir = join(tmpdir(), 'storybook-codemod-test');

  beforeEach(() => {
    mkdirSync(tempDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  /**
   * https://github.com/storybookjs/storybook/issues/33639
   *
   * Reproduces the bug where csf-2-to-3 silently fails because filenames are incorrectly quoted
   * when passed to spawnSync.
   *
   * Test file from:
   * https://github.com/seb-oss/green/blob/b634df24d2dae157300f73b711e569d1755eb138/libs/react-charts/src/lib/chart.stories.tsx
   */
  it('should transform CSF2 Template.bind({}) files with csf-2-to-3', async () => {
    const storyFile = join(tempDir, 'chart.stories.tsx');
    writeFileSync(storyFile, csf2Source);

    await migrate('csf-2-to-3', {
      glob: storyFile,
    });

    const result = readFileSync(storyFile, 'utf-8');

    // csf-2-to-3 should transform Template.bind({}) to CSF3 object
    expect(result).not.toContain('Template.bind({})');
    expect(result).toContain('export const SimpleBar = {');
  });

  it('keeps the code it does not change as written in a project without Prettier', async () => {
    const storyFile = join(tempDir, 'chart.stories.tsx');
    writeFileSync(storyFile, csf2Source);

    await migrate('csf-2-to-3', { glob: storyFile });

    expect(readFileSync(storyFile, 'utf-8')).toMatchInlineSnapshot(`
      "import { Meta, StoryFn } from '@storybook/react-vite'

      import { Chart, ChartProps } from './chart'

      export default {
        component: Chart,
        title: 'Chart',
      } as Meta

      export const SimpleBar = {
        args: { name: 'test' },
      }
      "
    `);
  });

  it('indents multi-line annotations in a project without Prettier', async () => {
    const storyFile = join(tempDir, 'button.stories.tsx');
    writeFileSync(
      storyFile,
      `export default { title: 'Button' };

export const Primary = (args) => {
  return <Button {...args} />;
};
Primary.args = {
  label: 'Button',
};
`
    );

    await migrate('csf-2-to-3', { glob: storyFile });

    expect(readFileSync(storyFile, 'utf-8')).toMatchInlineSnapshot(`
      "export default { title: 'Button' };

      export const Primary = {
        render: (args) => {
          return <Button {...args} />;
        },
        args: {
          label: 'Button',
        },
      };
      "
    `);
  });

  it('should handle filenames with spaces', async () => {
    const storyFile = join(tempDir, 'my component.stories.tsx');
    writeFileSync(storyFile, csf2Source);

    await migrate('csf-2-to-3', {
      glob: storyFile,
    });

    const result = readFileSync(storyFile, 'utf-8');

    expect(result).not.toContain('Template.bind({})');
    expect(result).toContain('export const SimpleBar = {');
  });

  it('should handle glob patterns', async () => {
    const storyFile1 = join(tempDir, 'chart.stories.tsx');
    const storyFile2 = join(tempDir, 'button.stories.tsx');
    writeFileSync(storyFile1, csf2Source);
    writeFileSync(storyFile2, csf2Source);

    await migrate('csf-2-to-3', {
      glob: join(tempDir, '*.stories.tsx'),
    });

    const result1 = readFileSync(storyFile1, 'utf-8');
    const result2 = readFileSync(storyFile2, 'utf-8');

    expect(result1).not.toContain('Template.bind({})');
    expect(result2).not.toContain('Template.bind({})');
  });

  it('leaves a file that does not parse alone and skips renaming', async () => {
    const brokenFile = join(tempDir, 'broken.stories.tsx');
    const storyFile = join(tempDir, 'chart.stories.tsx');
    writeFileSync(brokenFile, 'export const = ;');
    writeFileSync(storyFile, csf2Source);

    await migrate('upgrade-deprecated-types', {
      glob: join(tempDir, '*.stories.tsx'),
      rename: '.tsx:.ts',
    });

    expect(readFileSync(brokenFile, 'utf-8')).toBe('export const = ;');
    expect(logger.log).toHaveBeenCalledWith('Skipped renaming because of errors.');
    expect(existsSync(storyFile)).toBe(true);
  });

  it('renames only the files that end with the suffix', async () => {
    writeFileSync(join(tempDir, 'a.stories.js'), 'export default {};');
    writeFileSync(join(tempDir, 'b.stories.mjs'), 'export default {};');

    await migrate('upgrade-deprecated-types', {
      glob: join(tempDir, '*.stories.*'),
      rename: '.js:.ts',
    });

    expect(existsSync(join(tempDir, 'a.stories.ts'))).toBe(true);
    expect(existsSync(join(tempDir, 'b.stories.mjs'))).toBe(true);
  });

  it('appends the new suffix when the old one is empty', async () => {
    writeFileSync(join(tempDir, 'a.stories'), 'export default {};');
    writeFileSync(join(tempDir, 'b.stories'), 'export default {};');

    await migrate('upgrade-deprecated-types', {
      glob: join(tempDir, '*.stories'),
      rename: ':.ts',
    });

    expect(existsSync(join(tempDir, 'a.stories.ts'))).toBe(true);
    expect(existsSync(join(tempDir, 'b.stories.ts'))).toBe(true);
  });

  it('should handle recursive glob patterns', async () => {
    const nestedDir = join(tempDir, 'components', 'charts');
    mkdirSync(nestedDir, { recursive: true });

    const storyFile1 = join(tempDir, 'root.stories.tsx');
    const storyFile2 = join(nestedDir, 'nested.stories.tsx');
    writeFileSync(storyFile1, csf2Source);
    writeFileSync(storyFile2, csf2Source);

    await migrate('csf-2-to-3', {
      glob: join(tempDir, '**/*.stories.tsx'),
    });

    const result1 = readFileSync(storyFile1, 'utf-8');
    const result2 = readFileSync(storyFile2, 'utf-8');

    expect(result1).not.toContain('Template.bind({})');
    expect(result2).not.toContain('Template.bind({})');
  });
});
