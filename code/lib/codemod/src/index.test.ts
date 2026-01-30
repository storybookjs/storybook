import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runCodemod } from './index';

const logger = {
  step: vi.fn(),
  log: vi.fn(),
};

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

describe('runCodemod', () => {
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

    await runCodemod('csf-2-to-3', {
      glob: storyFile,
      logger,
    });

    const result = readFileSync(storyFile, 'utf-8');

    // csf-2-to-3 should transform Template.bind({}) to CSF3 object
    expect(result).not.toContain('Template.bind({})');
    expect(result).toContain('export const SimpleBar = {');
  });

  it('should handle filenames with spaces', async () => {
    const storyFile = join(tempDir, 'my component.stories.tsx');
    writeFileSync(storyFile, csf2Source);

    await runCodemod('csf-2-to-3', {
      glob: storyFile,
      logger,
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

    await runCodemod('csf-2-to-3', {
      glob: join(tempDir, '*.stories.tsx'),
      logger,
    });

    const result1 = readFileSync(storyFile1, 'utf-8');
    const result2 = readFileSync(storyFile2, 'utf-8');

    expect(result1).not.toContain('Template.bind({})');
    expect(result2).not.toContain('Template.bind({})');
  });

  it('should handle recursive glob patterns', async () => {
    const nestedDir = join(tempDir, 'components', 'charts');
    mkdirSync(nestedDir, { recursive: true });

    const storyFile1 = join(tempDir, 'root.stories.tsx');
    const storyFile2 = join(nestedDir, 'nested.stories.tsx');
    writeFileSync(storyFile1, csf2Source);
    writeFileSync(storyFile2, csf2Source);

    await runCodemod('csf-2-to-3', {
      glob: join(tempDir, '**/*.stories.tsx'),
      logger,
    });

    const result1 = readFileSync(storyFile1, 'utf-8');
    const result2 = readFileSync(storyFile2, 'utf-8');

    expect(result1).not.toContain('Template.bind({})');
    expect(result2).not.toContain('Template.bind({})');
  });
});
