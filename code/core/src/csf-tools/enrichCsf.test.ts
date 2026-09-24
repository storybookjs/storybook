import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { formatCsf, loadCsf } from './CsfFile.ts';
import type { EnrichCsfOptions } from './enrichCsf.ts';
import { enrichCsf, extractSource } from './enrichCsf.ts';

type RuntimeStory = {
  _tag?: string;
  input?: { parameters?: RuntimeParameters };
  parameters?: RuntimeParameters;
  extend: () => RuntimeStory;
};

type RuntimeParameters = {
  docs?: {
    description?: { story?: string };
    source?: { originalSource?: string };
  };
};

expect.addSnapshotSerializer({
  print: (val: any) => val.replace(/\\r\\n/gm, '\\n'),
  test: () => true,
});

const enrich = async (code: string, originalCode: string, options?: EnrichCsfOptions) => {
  // we don't actually care about the title

  const csf = loadCsf(code, { makeTitle: (userTitle) => userTitle ?? 'Unknown' }).parse();
  const csfSource = loadCsf(originalCode, {
    makeTitle: (userTitle) => userTitle ?? 'Unknown',
  }).parse();
  await enrichCsf(csf, csfSource, options);
  const formattedCsf = formatCsf(csf);
  if (typeof formattedCsf !== 'string') {
    throw new Error('Expected formatted CSF code');
  }
  return formattedCsf;
};

describe('enrichCsf', () => {
  describe('source', () => {
    it('csf1', async () => {
      expect(
        await enrich(
          dedent`
          // compiled code
          export default {
           title: 'Button',
          }
          export const Basic = () => React.createElement(Button)
        `,
          dedent`
        // original code
        export default {
         title: 'Button',
        }
        export const Basic = () => <Button />
      `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });
    it('csf2', async () => {
      expect(
        await enrich(
          dedent`
        // compiled code
        export default {
          title: 'Button',
        }
        const Template = (args) => React.createElement(Button, args);
        export const Basic = Template.bind({});
        Basic.parameters = { foo: 'bar' }
      `,
          dedent`
          // original code
          export default {
            title: 'Button',
          }
          const Template = (args) => <Button {...args} />
          export const Basic = Template.bind({});
          Basic.parameters = { foo: 'bar' }
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        const Template = args => React.createElement(Button, args);
        export const Basic = Template.bind({});
        Basic.parameters = {
          foo: 'bar'
        };
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "args => <Button {...args} />",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });
    it('csf3', async () => {
      expect(
        await enrich(
          dedent`
        // compiled code
        export default {
          title: 'Button',
        }
        export const Basic = { parameters: { foo: 'bar' } }
      `,
          dedent`
          // original code
          export default {
            title: 'Button',
          }
          export const Basic = {
            parameters: { foo: 'bar' }
          }
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        export const Basic = {
          parameters: {
            foo: 'bar'
          }
        };
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "{\\n  parameters: {\\n    foo: 'bar'\\n  }\\n}",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });
    it('csf factories', async () => {
      expect(
        await enrich(
          dedent`
          // compiled code
          import {config} from "/.storybook/preview.ts";
          const meta = config.meta({
              args: {
                label: "Hello world!"
              }
          });
          export const Story = meta.story({});
        `,
          dedent`
          // original code
          import {config} from "#.storybook/preview.ts";
          const meta = config.meta({
              args: {
                label: "Hello world!"
              }
          });
          export const Story = meta.story({});
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        import { config } from "/.storybook/preview.ts";
        const meta = config.meta({
          args: {
            label: "Hello world!"
          }
        });
        export const Story = meta.story({});
        Story.input.parameters = {
          ...Story.input.parameters,
          docs: {
            ...Story.input.parameters?.docs,
            source: {
              originalSource: "meta.story({})",
              ...Story.input.parameters?.docs?.source
            }
          }
        };
      `);
    });
    it('csf factories with .extend()', async () => {
      expect(
        await enrich(
          dedent`
          // compiled code
          import {config} from "/.storybook/preview.ts";
          const meta = config.meta({
              args: {
                label: "Hello world!"
              }
          });
          export const Story = meta.story({});
          export const Extended = Story.extend({});
        `,
          dedent`
          // original code
          import {config} from "#.storybook/preview.ts";
          const meta = config.meta({
              args: {
                label: "Hello world!"
              }
          });
          export const Story = meta.story({});
          export const Extended = Story.extend({});
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        import { config } from "/.storybook/preview.ts";
        const meta = config.meta({
          args: {
            label: "Hello world!"
          }
        });
        export const Story = meta.story({});
        export const Extended = Story.extend({});
        Story.input.parameters = {
          ...Story.input.parameters,
          docs: {
            ...Story.input.parameters?.docs,
            source: {
              originalSource: "meta.story({})",
              ...Story.input.parameters?.docs?.source
            }
          }
        };
        if (Extended._tag === "Story") {
          Extended.input.parameters = {
            ...Extended.input.parameters,
            docs: {
              ...Extended.input.parameters?.docs,
              source: {
                originalSource: "Story.extend({})",
                ...Extended.input.parameters?.docs?.source
              }
            }
          };
        } else {
          Extended.parameters = {
            ...Extended.parameters,
            docs: {
              ...Extended.parameters?.docs,
              source: {
                originalSource: "Story.extend({})",
                ...Extended.parameters?.docs?.source
              }
            }
          };
        }
      `);
    });
    it('enriches factory and non-factory extensions through their runtime parameters', async () => {
      const output = await enrich(
        dedent`
          import { config } from "/.storybook/preview.ts";
          import { ImportedStory } from './factory.stories';
          import { utility } from './utility';
          const componentMeta = config.meta({ title: 'Button' });
          export default componentMeta;
          export const Renamed = componentMeta.story({});
          const Local = componentMeta.story({});
          /** Local extension description */
          export const LocalExtended = Local.extend({});
          /** Imported extension description */
          export const ImportedExtended = ImportedStory.extend({});
          /** Imported utility extension description */
          export const ImportedUtilityExtended = utility.extend({});
          /** Chained extension description */
          export const Chained = LocalExtended.extend({});
          const localUtility = {
            extend: (value) => ({ input: value, extend: localUtility.extend }),
          };
          /** Utility extension description */
          export const UtilityExtended = localUtility.extend({});
          /** Chained utility extension description */
          export const ChainedUtilityExtended = UtilityExtended.extend({});
        `,
        dedent`
          import { config } from "#.storybook/preview.ts";
          import { ImportedStory } from './factory.stories';
          import { utility } from './utility';
          const componentMeta = config.meta({ title: 'Button' });
          export default componentMeta;
          export const Renamed = componentMeta.story({});
          const Local = componentMeta.story({});
          /** Local extension description */
          export const LocalExtended = Local.extend({});
          /** Imported extension description */
          export const ImportedExtended = ImportedStory.extend({});
          /** Imported utility extension description */
          export const ImportedUtilityExtended = utility.extend({});
          /** Chained extension description */
          export const Chained = LocalExtended.extend({});
          const localUtility = {
            extend: (value) => ({ input: value, extend: localUtility.extend }),
          };
          /** Utility extension description */
          export const UtilityExtended = localUtility.extend({});
          /** Chained utility extension description */
          export const ChainedUtilityExtended = UtilityExtended.extend({});
        `
      );

      expect(output).toContain('Renamed.input.parameters');
      expect(output).toContain('if (LocalExtended._tag === "Story")');
      expect(output).toContain('if (Chained._tag === "Story")');
      expect(output).toContain('if (ImportedExtended._tag === "Story")');
      expect(output).toContain('if (ImportedUtilityExtended._tag === "Story")');
      expect(output).toContain('if (UtilityExtended._tag === "Story")');
      expect(output).toContain('if (ChainedUtilityExtended._tag === "Story")');
      expect(output).toContain('ImportedUtilityExtended.parameters');
      expect(output).toContain('UtilityExtended.parameters');
      expect(output).toContain('ChainedUtilityExtended.parameters');
      expect(output).toContain('originalSource: "Local.extend({})"');
      expect(output).toContain('originalSource: "ImportedStory.extend({})"');
      expect(output).toContain('originalSource: "LocalExtended.extend({})"');
      expect(output).toContain('story: "Local extension description"');
      expect(output).toContain('story: "Imported extension description"');
      expect(output).toContain('story: "Imported utility extension description"');
      expect(output).toContain('story: "Chained extension description"');
      expect(output).toContain('story: "Utility extension description"');
      expect(output).toContain('story: "Chained utility extension description"');

      const createFactoryStory = (): RuntimeStory => ({
        _tag: 'Story',
        input: {},
        extend: createFactoryStory,
      });
      const createUtilityStory = (): RuntimeStory => ({
        input: {},
        parameters: {},
        extend: createUtilityStory,
      });
      const runtime: {
        config: { meta: () => { story: () => RuntimeStory } };
        ImportedStory: RuntimeStory;
        utility: RuntimeStory;
        results?: Record<string, RuntimeStory>;
      } = {
        config: { meta: () => ({ story: createFactoryStory }) },
        ImportedStory: createFactoryStory(),
        utility: createUtilityStory(),
      };
      const executableOutput = `${output
        .replace(/^import.*;\n/gm, '')
        .replace('export default componentMeta;\n', '')
        .replaceAll('export const ', 'const ')}
        globalThis.results = {
          LocalExtended,
          ImportedExtended,
          ImportedUtilityExtended,
          Chained,
          UtilityExtended,
          ChainedUtilityExtended,
        };`;
      runInNewContext(executableOutput, runtime);

      expect(runtime.results?.LocalExtended.input?.parameters?.docs).toEqual({
        source: { originalSource: 'Local.extend({})' },
        description: { story: 'Local extension description' },
      });
      expect(runtime.results?.ImportedExtended.input?.parameters?.docs).toEqual({
        source: { originalSource: 'ImportedStory.extend({})' },
        description: { story: 'Imported extension description' },
      });
      expect(runtime.results?.UtilityExtended.parameters?.docs).toEqual({
        source: { originalSource: 'localUtility.extend({})' },
        description: { story: 'Utility extension description' },
      });
      expect(runtime.results?.ChainedUtilityExtended.parameters?.docs).toEqual({
        source: { originalSource: 'UtilityExtended.extend({})' },
        description: { story: 'Chained utility extension description' },
      });
    });
    it('does not treat methods on a CSF3 meta object as factory stories', async () => {
      const output = await enrich(
        dedent`
          const componentMeta = { title: 'Button', make: () => ({}) };
          export default componentMeta;
          export const Basic = componentMeta.make();
        `,
        dedent`
          const componentMeta = { title: 'Button', make: () => ({}) };
          export default componentMeta;
          export const Basic = componentMeta.make();
        `
      );

      expect(output).toContain('Basic.parameters');
      expect(output).not.toContain('Basic.input.parameters');
    });
    it('multiple stories', async () => {
      expect(
        await enrich(
          dedent`
        // compiled code
        export default {
          title: 'Button',
        }
        export const A = {}
        export const B = {}
      `,
          dedent`
          // original code
          export default {
            title: 'Button',
          }
          export const A = {}
          export const B = {}
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        export const A = {};
        export const B = {};
        A.parameters = {
          ...A.parameters,
          docs: {
            ...A.parameters?.docs,
            source: {
              originalSource: "{}",
              ...A.parameters?.docs?.source
            }
          }
        };
        B.parameters = {
          ...B.parameters,
          docs: {
            ...B.parameters?.docs,
            source: {
              originalSource: "{}",
              ...B.parameters?.docs?.source
            }
          }
        };
      `);
    });
  });

  describe('story descriptions', () => {
    it('skips inline comments', async () => {
      expect(
        await enrich(
          dedent`
        // compiled code
        export default {
         title: 'Button',
        }
        // The most basic button
        export const Basic = () => React.createElement(Button);
      `,
          dedent`
          // original code
          export default {
           title: 'Button',
          }
          // The most basic button
          export const Basic = () => <Button />
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        // The most basic button
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });

    it('skips blocks without jsdoc', async () => {
      expect(
        await enrich(
          dedent`
          // compiled code
          export default {
           title: 'Button',
          }
          export const Basic = () => React.createElement(Button)
        `,
          dedent`
          // original code
          export default {
           title: 'Button',
          }
          /* The most basic button */
          export const Basic = () => <Button />
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });

    it('JSDoc single-line', async () => {
      expect(
        await enrich(
          dedent`
          // compiled code
          export default {
           title: 'Button',
          }
          export const Basic = () => React.createElement(Button);
        `,
          dedent`
          // original code
          export default {
           title: 'Button',
          }
          /** The most basic button */
          export const Basic = () => <Button />
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            },
            description: {
              story: "The most basic button",
              ...Basic.parameters?.docs?.description
            }
          }
        };
      `);
    });

    it('JSDoc multi-line', async () => {
      expect(
        await enrich(
          dedent`
        // compiled code
        export default {
         title: 'Button',
        }
        export const Basic = () => React.createElement(Button);
      `,
          dedent`
          // original code
          export default {
           title: 'Button',
          }
          /**
           * The most basic button
           * 
           * In a block!
           */
          export const Basic = () => <Button />
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            },
            description: {
              story: "The most basic button\\n\\nIn a block!",
              ...Basic.parameters?.docs?.description
            }
          }
        };
      `);
    });

    it('preserves indentation', async () => {
      expect(
        await enrich(
          dedent`
          // compiled code
          export default {
           title: 'Button',
          }
          export const Basic = () => React.createElement(Button);
        `,
          dedent`
        // original code
        export default {
         title: 'Button',
        }
        /**
         * - A bullet list
         *   - A sub-bullet
         * - A second bullet
         */
        export const Basic = () => <Button />
      `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            },
            description: {
              story: "- A bullet list\\n  - A sub-bullet\\n- A second bullet",
              ...Basic.parameters?.docs?.description
            }
          }
        };
      `);
    });
  });

  describe('meta descriptions', () => {
    it('skips inline comments', async () => {
      expect(
        await enrich(
          dedent`
        // compiled code
        export default {
          title: 'Button',
        }
        export const Basic = () => React.createElement(Button);
        `,
          dedent`
        // original code
        // The most basic button
        export default {
          title: 'Button',
        }
        export const Basic = () => <Button />
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });

    it('skips blocks without jsdoc', async () => {
      expect(
        await enrich(
          dedent`
        // compiled code
        export default {
         title: 'Button',
        }
        export const Basic = () => React.createElement();
      `,
          dedent`
          // original code
          /* The most basic button */
          export default {
           title: 'Button',
          }
          export const Basic = () => <Button />
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        export const Basic = () => React.createElement();
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });

    it('JSDoc single-line', async () => {
      expect(
        await enrich(
          dedent`
          // compiled code
          export default {
           title: 'Button'
          }
          export const Basic = () => React.createElement(Button)
        `,
          dedent`
          // original code
          /** The most basic button */
          export default {
           title: 'Button'
          }
          export const Basic = () => <Button />
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button',
          parameters: {
            docs: {
              description: {
                component: "The most basic button"
              }
            }
          }
        };
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });

    it('JSDoc multi-line', async () => {
      expect(
        await enrich(
          dedent`
        // compiled code
        export default {
         title: 'Button',
        }
        export const Basic = () => React.createElement();
      `,
          dedent`
          // original code
          /**
           * The most basic button
           * 
           * In a block!
           */
          export default {
           title: 'Button',
          }
          export const Basic = () => <Button />
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button',
          parameters: {
            docs: {
              description: {
                component: "The most basic button\\n\\nIn a block!"
              }
            }
          }
        };
        export const Basic = () => React.createElement();
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });

    it('preserves indentation', async () => {
      expect(
        await enrich(
          dedent`
        // compiled code
        export default {
         title: 'Button',
        }
        export const Basic = () => React.createElement(Button);
      `,
          dedent`
          // original code
          /**
           * - A bullet list
           *   - A sub-bullet
           * - A second bullet
           */
          export default {
           title: 'Button',
          }
          export const Basic = () => <Button />
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button',
          parameters: {
            docs: {
              description: {
                component: "- A bullet list\\n  - A sub-bullet\\n- A second bullet"
              }
            }
          }
        };
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });

    it('correctly interleaves parameters', async () => {
      expect(
        await enrich(
          dedent`
        // compiled code
        export default {
          title: 'Button',
          parameters: {
            foo: 'bar',
            docs: { story: { inline: true } }
          }
        }
        export const Basic = () => React.createElement(Button);
      `,
          dedent`
          /** The most basic button */
          export default {
            title: 'Button',
            parameters: {
              foo: 'bar',
              docs: { story: { inline: true } }
            }
          }
          export const Basic = () => <Button />
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button',
          parameters: {
            foo: 'bar',
            docs: {
              story: {
                inline: true
              },
              description: {
                component: "The most basic button"
              }
            }
          }
        };
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });

    it('respects user component description', async () => {
      expect(
        await enrich(
          dedent`
        // compiled code
        export default {
          title: 'Button',
          parameters: {
            docs: {
              description: {
                component: 'hahaha'
              }
            }
          }
        }
        export const Basic = () => React.createElement(Button);
      `,
          dedent`
          // original code
          /** The most basic button */
          export default {
            title: 'Button',
            parameters: {
              docs: {
                description: {
                  component: 'hahaha'
                }
              }
            }
          }
          export const Basic = () => <Button />
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button',
          parameters: {
            docs: {
              description: {
                component: 'hahaha'
              }
            }
          }
        };
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });

    it('respects meta variables', async () => {
      expect(
        await enrich(
          dedent`
        // compiled code
        const meta = {
          title: 'Button'
        }
        export default meta;
        export const Basic = () => React.createElement(Button);
        `,
          dedent`
        // original code
        /** The most basic button */
        const meta = {
          title: 'Button'
        }
        /** This should be ignored */
        export default meta;
        export const Basic = () => <Button />
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        const meta = {
          title: 'Button',
          parameters: {
            docs: {
              description: {
                component: "The most basic button"
              }
            }
          }
        };
        export default meta;
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });
  });

  describe('options', () => {
    it('disableSource', async () => {
      expect(
        await enrich(
          dedent`
          // compiled code
          export default {
           title: 'Button',
          }
          export const Basic = () => React.createElement(Button);
        `,
          dedent`
          // original code
          export default {
           title: 'Button',
          }
          /** The most basic button */
          export const Basic = () => <Button />
        `,
          { disableSource: true }
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            description: {
              story: "The most basic button",
              ...Basic.parameters?.docs?.description
            }
          }
        };
      `);
    });

    it('disableDescription', async () => {
      expect(
        await enrich(
          dedent`
          // compiled code
          export default {
           title: 'Button',
          }
          export const Basic = () => React.createElement(Button);
        `,
          dedent`
          // original code
          export default {
           title: 'Button',
          }
          /** The most basic button */
          export const Basic = () => <Button />
        `,
          { disableDescription: true }
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        export const Basic = () => React.createElement(Button);
        Basic.parameters = {
          ...Basic.parameters,
          docs: {
            ...Basic.parameters?.docs,
            source: {
              originalSource: "() => <Button />",
              ...Basic.parameters?.docs?.source
            }
          }
        };
      `);
    });

    it('disable all', async () => {
      expect(
        await enrich(
          dedent`
          // compiled code
          export default {
           title: 'Button',
          }
          export const Basic = () => React.createElement(Button);
        `,
          dedent`
          // original code
          export default {
           title: 'Button',
          }
          /** The most basic button */
          export const Basic = () => <Button />
        `,
          { disableSource: true, disableDescription: true }
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        export default {
          title: 'Button'
        };
        export const Basic = () => React.createElement(Button);
      `);
    });
  });
});

const source = (csfExport: string) => {
  const code = dedent`
    export default { title: 'Button' }
    ${csfExport}
  `;
  const csf = loadCsf(code, { makeTitle: (userTitle) => userTitle }).parse();
  const exportNode = Object.values(csf._storyExports)[0];
  return extractSource(exportNode);
};

describe('extractSource', () => {
  it('csf1', () => {
    expect(
      source(dedent`
        export const Basic = () => <Button />
      `)
    ).toMatchInlineSnapshot(`() => <Button />`);
  });
  it('csf2', () => {
    expect(
      source(dedent`
        export const Basic =  (args) => <Button {...args} />;
      `)
    ).toMatchInlineSnapshot(`args => <Button {...args} />`);
  });
  it('csf3', () => {
    expect(
      source(dedent`
        export const Basic = {
          parameters: { foo: 'bar' }
        }
      `)
    ).toMatchInlineSnapshot(`
      {
        parameters: {
          foo: 'bar'
        }
      }
    `);
  });
});
