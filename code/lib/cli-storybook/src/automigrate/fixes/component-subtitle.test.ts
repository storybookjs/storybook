import { readFile, writeFile } from 'node:fs/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  componentSubtitle,
  transformPreviewSource,
  transformStorySource,
} from './component-subtitle.ts';

vi.mock('node:fs/promises', { spy: true });

afterEach(() => vi.restoreAllMocks());

describe('component-subtitle', () => {
  it('moves a meta componentSubtitle value to docs.subtitle', () => {
    const transformed = transformStorySource(`
        export default {
          component: Button,
          parameters: { componentSubtitle: subtitle }
        };
      `);
    expect(transformed).toContain('subtitle: subtitle');
    expect(transformed).not.toContain('componentSubtitle');
  });

  it('moves a componentSubtitle value from an identifier meta', () => {
    const transformed = transformStorySource(`
      const meta = {
        component: Button,
        parameters: { componentSubtitle: 'Legacy' }
      } satisfies Meta;
      export default meta;
    `);

    expect(transformed).toContain("subtitle: 'Legacy'");
    expect(transformed).not.toContain('componentSubtitle');
  });

  it('rejects a separately exported story that cannot be classified safely', () => {
    expect(() =>
      transformStorySource(`
        export default { component: Button };
        const Primary = { parameters: { componentSubtitle: 'Legacy' } };
        export { Primary };
      `)
    ).toThrow('direct CSF parameters object');
  });

  it('adds subtitle to an existing docs object in a story', () => {
    expect(
      transformStorySource(`
        export default { component: Button };
        export const Primary = {
          parameters: {
            componentSubtitle: 'Legacy',
            docs: { source: { type: 'code' } }
          }
        };
      `)
    ).toContain("subtitle: 'Legacy'");
  });

  it('preserves the old static docs.subtitle precedence', () => {
    expect(
      transformStorySource(`
        export default {
          parameters: {
            componentSubtitle: 'Legacy',
            docs: { subtitle: 'Current' }
          }
        };
      `)
    ).toContain("docs: { subtitle: 'Current' }");
    expect(
      transformStorySource(`
        export default {
          parameters: {
            componentSubtitle: 'Legacy',
            docs: { subtitle: '' }
          }
        };
      `)
    ).toContain("docs: { subtitle: 'Legacy' }");
  });

  it('migrates preview parameters', () => {
    expect(
      transformPreviewSource(`
        export default {
          parameters: { componentSubtitle: 'Preview subtitle' }
        };
      `)
    ).toContain("subtitle: 'Preview subtitle'");
  });

  it('migrates static computed keys without creating duplicate docs fields', () => {
    const transformed = transformStorySource(`
      export default {
        parameters: {
          ['componentSubtitle']: 'Legacy',
          ['docs']: { ['subtitle']: '' }
        }
      };
    `);

    expect(transformed).not.toContain('componentSubtitle');
    expect(transformed).toContain("['subtitle']: 'Legacy'");
    expect(transformed?.match(/\['docs'\]/g)).toHaveLength(1);
  });

  it('ignores componentSubtitle text in a preview comment', () => {
    expect(
      transformPreviewSource(`
        // parameters.componentSubtitle was removed
        export default { parameters: {} };
      `)
    ).toBeNull();
  });

  it('rejects dynamic docs.subtitle precedence', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            componentSubtitle: 'Legacy',
            docs: { subtitle: getSubtitle() }
          }
        };
      `)
    ).toThrow('dynamic truthiness');
  });

  it('rejects a story migration when an inherited subtitle can win', () => {
    expect(() =>
      transformStorySource(`
        export default { parameters: { docs: { subtitle: 'Meta subtitle' } } };
        export const Primary = {
          parameters: { componentSubtitle: 'Story subtitle' }
        };
      `)
    ).toThrow('inherited parameters.docs.subtitle');
  });

  it('rejects a meta migration when a preview subtitle can win', () => {
    expect(() =>
      transformStorySource(
        `export default { parameters: { componentSubtitle: 'Meta subtitle' } };`,
        true
      )
    ).toThrow('inherited parameters.docs.subtitle');
  });

  it('rejects a story migration when meta parameters are indirect', () => {
    expect(() =>
      transformStorySource(`
        const parameters = { docs: { subtitle: 'Meta subtitle' } };
        export default { parameters };
        export const Primary = {
          parameters: { componentSubtitle: 'Story subtitle' }
        };
      `)
    ).toThrow('direct CSF parameters object');
  });

  it('rejects side-effectful componentSubtitle expressions', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            componentSubtitle: registerSubtitle(),
            docs: { subtitle: 'Current' }
          }
        };
      `)
    ).toThrow('evaluation cannot be moved safely');
  });

  it('ignores unrelated component props with the same name', () => {
    expect(
      transformStorySource(`
        export default { component: Button };
        export const Primary = { args: { componentSubtitle: 'A component prop' } };
      `)
    ).toBeNull();
  });

  it('rejects spread parameters', () => {
    expect(() =>
      transformStorySource(`
        export default {
          parameters: {
            ...parameters,
            componentSubtitle: 'Legacy'
          }
        };
      `)
    ).toThrow('ambiguous parameters object');
  });

  it('rejects componentSubtitle outside a direct CSF parameters object', () => {
    expect(() =>
      transformStorySource(`
        const parameters = { componentSubtitle: 'Legacy' };
        export default { parameters };
      `)
    ).toThrow('direct CSF parameters object');
  });

  it('does not write any file when one file cannot be migrated', async () => {
    vi.mocked(readFile).mockImplementation(async (file) =>
      Buffer.from(
        file === 'safe.stories.ts'
          ? `export default { parameters: { componentSubtitle: 'Safe' } }`
          : `export default {
              parameters: {
                componentSubtitle: 'Legacy',
                docs: { subtitle: getSubtitle() }
              }
            }`
      )
    );

    await expect(
      componentSubtitle.run!({
        result: { files: ['safe.stories.ts', 'unsafe.stories.ts'] },
      } as never)
    ).rejects.toThrow('- unsafe.stories.ts: parameters.docs.subtitle has dynamic truthiness');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('reads preview precedence even when the preview itself needs no migration', async () => {
    vi.mocked(readFile).mockImplementation(async (file) =>
      Buffer.from(
        file === '.storybook/preview.ts'
          ? `export default { parameters: { docs: { subtitle: 'Global' } } }`
          : `export default { parameters: { componentSubtitle: 'Legacy' } }`
      )
    );

    await expect(
      componentSubtitle.run!({
        result: {
          files: ['Button.stories.ts'],
          previewConfigPath: '.storybook/preview.ts',
        },
      } as never)
    ).rejects.toThrow('inherited parameters.docs.subtitle');
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('treats indirect preview parameters as possible inherited precedence', async () => {
    vi.mocked(readFile).mockImplementation(async (file) =>
      Buffer.from(
        file === '.storybook/preview.ts'
          ? `const parameters = { docs: { subtitle: 'Global' } };
             export default { parameters };`
          : `export default { parameters: { componentSubtitle: 'Legacy' } }`
      )
    );

    await expect(
      componentSubtitle.run!({
        result: {
          files: ['Button.stories.ts'],
          previewConfigPath: '.storybook/preview.ts',
        },
      } as never)
    ).rejects.toThrow('inherited parameters.docs.subtitle');
  });

  it('rejects top-level spread composition that can hide subtitle parameters', () => {
    expect(() =>
      transformStorySource(`
        const base = { parameters: { docs: { subtitle: 'Meta' } } };
        export default { ...base };
        export const Primary = {
          parameters: { componentSubtitle: 'Legacy' }
        };
      `)
    ).toThrow('direct CSF parameters object');
  });

  it('rejects a spread-only direct story export', () => {
    expect(() =>
      transformStorySource(`
        const base = { parameters: { componentSubtitle: 'Legacy' } };
        export default {};
        export const Primary = { ...base };
      `)
    ).toThrow('direct CSF parameters object');
  });
});
