import { describe, expect, it } from 'vitest';

import { printConfig, printCsf } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import {
  transformPreviewA11yParameters,
  transformStoryA11yParameters,
} from './addon-a11y-parameters';

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? val : val.toString()),
  test: () => true,
});

const transformStories = (code: string) => {
  const transformed = transformStoryA11yParameters(code);
  return transformed ? printCsf(transformed).code : null;
};

const transformPreview = (code: string) => {
  const transformed = transformPreviewA11yParameters(code);
  return transformed ? printConfig(transformed).code : null;
};

describe('a11yParameters', () => {
  describe('transformA11yParameters', () => {
    it('should transform a11y element to context in story parameters', () => {
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

      const transformedCode = transformStories(code);

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

    it('should not transform if a11y element is not present', () => {
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

      expect(transformStories(code)).toBeNull();
    });

    it('should handle stories with CSF v2 parameter style', () => {
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

      expect(transformStories(code)).toMatchInlineSnapshot(`
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
  });

  describe('transformPreviewA11yParameters', () => {
    it('should transform a11y element to context in preview parameters', () => {
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

      expect(transformPreview(code)).toMatchInlineSnapshot(`
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

    it('should not transform if a11y element is not present', () => {
      const code = dedent`
        const preview = {
          parameters: {},
        };
        export default preview;
      `;

      expect(transformPreview(code)).toBeNull();
    });
  });
});
