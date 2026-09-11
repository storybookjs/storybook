import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JsPackageManager } from 'storybook/internal/common';

import { fs, vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { addonA11yParameters } from './addon-a11y-parameters.ts';

vi.mock('node:fs/promises', { spy: true });

expect.addSnapshotSerializer({
  serialize: (val) => (typeof val === 'string' ? val : val.toString()),
  test: () => true,
});

beforeEach(() => {
  vol.reset();
  vi.mocked(readFile).mockImplementation(async (file) =>
    (await fs.promises.readFile(file.toString(), 'utf8')).toString()
  );
  vi.mocked(writeFile).mockImplementation(async (file, data) => {
    await fs.promises.writeFile(file.toString(), data.toString());
  });
});

const migrate = async (code: string, kind: 'story' | 'preview') => {
  const file = resolve(kind === 'story' ? 'Button.stories.tsx' : '.storybook/preview.ts');
  vol.fromJSON({ [file]: code });

  assert(addonA11yParameters.run);
  await addonA11yParameters.run({
    packageManager: vi.mocked(JsPackageManager.prototype),
    result: {
      storyFilesToUpdate: kind === 'story' ? [file] : [],
      previewFileToUpdate: kind === 'preview' ? file : undefined,
    },
    mainConfigPath: resolve('.storybook/main.ts'),
    mainConfig: { stories: [] },
    configDir: resolve('.storybook'),
    storybookVersion: '9.0.0',
    storiesPaths: kind === 'story' ? [file] : [],
  });

  return fs.readFileSync(file, 'utf8');
};

describe('addon-a11y-parameters run', () => {
  describe('stories', () => {
    it('should transform a11y element to context in story parameters', async () => {
      const code = dedent`
        import { StoryObj } from '@storybook/react-vite';
        export default {
          title: 'Button',
          parameters: {
            a11y: {
              element: '#root',
            },
          },
        };
        export const TypeAssign: StoryObj = {
          parameters: {
            a11y: {
              element: '#root',
            },
          },
        };
        export const TypeAlias = {
          parameters: {
            a11y: {
              element: '#root',
            },
          },
        } as StoryObj;
        export const TypeSatisfies = {
          parameters: {
            a11y: {
              element: '#root',
            },
          },
        } satisfies StoryObj;
        export const WithNestedProperties = {
          parameters: {
            a11y: {
              element: '#app',
              config: {
                rules: [{ id: 'xyz', options: {} }],
              },
              options: {},
            },
          },
        };
      `;

      const transformedCode = await migrate(code, 'story');

      expect(transformedCode).toMatchInlineSnapshot(`
        import { StoryObj } from '@storybook/react-vite';
        export default {
          title: 'Button',
          parameters: {
            a11y: {
              context: '#root',
            },
          },
        };
        export const TypeAssign: StoryObj = {
          parameters: {
            a11y: {
              context: '#root',
            },
          },
        };
        export const TypeAlias = {
          parameters: {
            a11y: {
              context: '#root',
            },
          },
        } as StoryObj;
        export const TypeSatisfies = {
          parameters: {
            a11y: {
              context: '#root',
            },
          },
        } satisfies StoryObj;
        export const WithNestedProperties = {
          parameters: {
            a11y: {
              context: '#app',
              config: {
                rules: [{ id: 'xyz', options: {} }],
              },
              options: {},
            },
          },
        };
      `);
      expect(transformedCode).toContain("context: '#root'");
    });

    it('should not transform if a11y element is not present', async () => {
      const code = dedent`
        export default {
          title: 'Button'
        };
        export const Primary = {
          parameters: {
            a11y: {
              other: 'value',
            },
          },
        };
      `;

      expect(await migrate(code, 'story')).toBe(code);
    });

    it('should handle stories with CSF v2 parameter style', async () => {
      const code = dedent`
        export default {
          title: 'Button'
        };
        export const Primary = (args) => <Button {...args} />;
        Primary.parameters = {
          a11y: {
            element: '#root',
          }
        }
      `;

      expect(await migrate(code, 'story')).toMatchInlineSnapshot(`
        export default {
          title: 'Button'
        };
        export const Primary = (args) => <Button {...args} />;
        Primary.parameters = {
          a11y: {
            context: '#root',
          }
        }
      `);
    });

    it('should transform CSF4 meta and story objects', async () => {
      const code = dedent`
        import preview from './preview';

        const meta = preview.meta({
          parameters: { a11y: { element: '#meta' } },
        });
        export const Primary = meta.story({
          parameters: { a11y: { element: '#story' } },
        });
      `;

      expect(await migrate(code, 'story')).toMatchInlineSnapshot(`
        import preview from './preview';

        const meta = preview.meta({
          parameters: { a11y: { context: '#meta' } },
        });
        export const Primary = meta.story({
          parameters: { a11y: { context: '#story' } },
        });
      `);
    });

    it('should transform identifier-backed meta objects', async () => {
      const code = dedent`
        const configuration = {
          parameters: { a11y: { element: '#meta' } },
        };
        export default configuration;
      `;

      expect(await migrate(code, 'story')).toMatchInlineSnapshot(`
        const configuration = {
          parameters: { a11y: { context: '#meta' } },
        };
        export default configuration;
      `);
    });

    it('should transform parameters an earlier spread cannot shadow', async () => {
      const code = dedent`
        export default { title: 'Button' };
        export const Primary = {
          ...base,
          parameters: { a11y: { element: '#root' } },
        };
      `;

      expect(await migrate(code, 'story')).toMatchInlineSnapshot(`
        export default { title: 'Button' };
        export const Primary = {
          ...base,
          parameters: { a11y: { context: '#root' } },
        };
      `);
    });

    it('should leave story objects with a shadowing spread unchanged', async () => {
      const code = dedent`
        export default { title: 'Button' };
        export const Primary = {
          parameters: { a11y: { element: '#root' } },
          ...base,
        };
      `;

      expect(await migrate(code, 'story')).toBe(code);
    });
  });

  describe('preview', () => {
    it('transforms named parameters exports while preserving sibling fields', async () => {
      expect(
        await migrate(
          `export const parameters = {
          a11y: { config: {}, element: '#root', options: {} }
        };`,
          'preview'
        )
      ).toContain(`a11y: { config: {}, context: '#root', options: {} }`);
    });

    it('leaves dynamic a11y configuration unchanged', async () => {
      const code = 'export default { parameters: { a11y: createA11y() } };';
      expect(await migrate(code, 'preview')).toBe(code);
    });

    it('should transform a11y element to context in preview parameters', async () => {
      const code = dedent`
        const preview = {
          parameters: {
            a11y: {
              element: '#root',
            },
          },
        };
        export default preview;
      `;

      expect(await migrate(code, 'preview')).toMatchInlineSnapshot(`
        const preview = {
          parameters: {
            a11y: {
              context: '#root',
            },
          },
        };
        export default preview;
      `);
    });

    it('should not transform if a11y element is not present', async () => {
      const code = dedent`
        const preview = {
          parameters: {},
        };
        export default preview;
      `;

      expect(await migrate(code, 'preview')).toBe(code);
    });
  });
});
