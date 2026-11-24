import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { formatCsf, loadCsf } from './CsfFile.ts';
import type { EnrichCsfOptions } from './enrichCsf.ts';
import { enrichCsf, extractSource } from './enrichCsf.ts';

expect.addSnapshotSerializer({
  print: (val: any) => val,
  test: () => true,
});

const enrich = async (code: string, originalCode: string, options?: EnrichCsfOptions) => {
  // we don't actually care about the title

  const csf = loadCsf(code, { makeTitle: (userTitle) => userTitle ?? 'Unknown' }).parse();
  const csfSource = loadCsf(originalCode, {
    makeTitle: (userTitle) => userTitle ?? 'Unknown',
  }).parse();
  await enrichCsf(csf, csfSource, options);
  return formatCsf(csf);
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
         title: 'Button',
        }
        export const Basic = () => React.createElement(Button)
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source } } };
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
          title: 'Button',
        }
        const Template = (args) => React.createElement(Button, args);
        export const Basic = Template.bind({});
        Basic.parameters = { foo: 'bar' }
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "(args) => <Button {...args} />", ...Basic.parameters?.docs?.source } } };
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
          title: 'Button',
        }
        export const Basic = { parameters: { foo: 'bar' } }
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "{\\n  parameters: { foo: 'bar' }\\n}", ...Basic.parameters?.docs?.source } } };
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
        import {config} from "/.storybook/preview.ts";
        const meta = config.meta({
            args: {
              label: "Hello world!"
            }
        });
        export const Story = meta.story({});
        Story.input.parameters = { ...Story.input.parameters, docs: { ...Story.input.parameters?.docs, source: { originalSource: "meta.story({})", ...Story.input.parameters?.docs?.source } } };
      `);
    });
    it('csf factories typed with meta.type<>(), reused and extended', async () => {
      expect(
        await enrich(
          dedent`
          // compiled code
          import {config} from "/.storybook/preview.ts";
          const meta = config.meta({});
          const withIcon = meta.type();
          export const Story = meta.type().story({});
          export const Reused = withIcon.story({});
          export const Extended = Reused.extend({});
        `,
          dedent`
          // original code
          import {config} from "#.storybook/preview.ts";
          const meta = config.meta({});
          const withIcon = meta.type<{ args: { icon: string } }>();
          export const Story = meta.type<{ args: { icon: string } }>().story({});
          export const Reused = withIcon.story({});
          export const Extended = Reused.extend({});
        `
        )
      ).toMatchInlineSnapshot(`
        // compiled code
        import {config} from "/.storybook/preview.ts";
        const meta = config.meta({});
        const withIcon = meta.type();
        export const Story = meta.type().story({});
        export const Reused = withIcon.story({});
        export const Extended = Reused.extend({});
        Story.input.parameters = { ...Story.input.parameters, docs: { ...Story.input.parameters?.docs, source: { originalSource: "meta.type<{ args: { icon: string } }>().story({})", ...Story.input.parameters?.docs?.source } } };
        Reused.input.parameters = { ...Reused.input.parameters, docs: { ...Reused.input.parameters?.docs, source: { originalSource: "withIcon.story({})", ...Reused.input.parameters?.docs?.source } } };
        Extended.input.parameters = { ...Extended.input.parameters, docs: { ...Extended.input.parameters?.docs, source: { originalSource: "Reused.extend({})", ...Extended.input.parameters?.docs?.source } } };
      `);
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
          title: 'Button',
        }
        export const A = {}
        export const B = {}
        A.parameters = { ...A.parameters, docs: { ...A.parameters?.docs, source: { originalSource: "{}", ...A.parameters?.docs?.source } } };
        B.parameters = { ...B.parameters, docs: { ...B.parameters?.docs, source: { originalSource: "{}", ...B.parameters?.docs?.source } } };
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
         title: 'Button',
        }
        // The most basic button
        export const Basic = () => React.createElement(Button);
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source } } };
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
         title: 'Button',
        }
        export const Basic = () => React.createElement(Button)
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source } } };
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
         title: 'Button',
        }
        export const Basic = () => React.createElement(Button);
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source }, description: { story: "The most basic button", ...Basic.parameters?.docs?.description } } };
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
         title: 'Button',
        }
        export const Basic = () => React.createElement(Button);
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source }, description: { story: "The most basic button\\n\\nIn a block!", ...Basic.parameters?.docs?.description } } };
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
         title: 'Button',
        }
        export const Basic = () => React.createElement(Button);
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source }, description: { story: "- A bullet list\\n  - A sub-bullet\\n- A second bullet", ...Basic.parameters?.docs?.description } } };
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
          title: 'Button',
        }
        export const Basic = () => React.createElement(Button);
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source } } };
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
         title: 'Button',
        }
        export const Basic = () => React.createElement();
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source } } };
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
         parameters: { docs: { description: { component: "The most basic button" } } }
        }
        export const Basic = () => React.createElement(Button)
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source } } };
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
         parameters: { docs: { description: { component: "The most basic button\\n\\nIn a block!" } } },
        }
        export const Basic = () => React.createElement();
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source } } };
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
         parameters: { docs: { description: { component: "- A bullet list\\n  - A sub-bullet\\n- A second bullet" } } },
        }
        export const Basic = () => React.createElement(Button);
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source } } };
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
            docs: { story: { inline: true }, description: { component: "The most basic button" } }
          }
        }
        export const Basic = () => React.createElement(Button);
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source } } };
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
        }
        export const Basic = () => React.createElement(Button);
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source } } };
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
          parameters: { docs: { description: { component: "The most basic button" } } }
        }
        export default meta;
        export const Basic = () => React.createElement(Button);
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source } } };
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
         title: 'Button',
        }
        export const Basic = () => React.createElement(Button);
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, description: { story: "The most basic button", ...Basic.parameters?.docs?.description } } };
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
         title: 'Button',
        }
        export const Basic = () => React.createElement(Button);
        Basic.parameters = { ...Basic.parameters, docs: { ...Basic.parameters?.docs, source: { originalSource: "() => <Button />", ...Basic.parameters?.docs?.source } } };
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
         title: 'Button',
        }
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
  return extractSource(exportNode, csf._code, csf.editor);
};

describe('extractSource', () => {
  it('normalizes CRLF line endings in the source and descriptions', async () => {
    const code = [
      "export default { title: 'Button' };",
      '/**',
      ' * Line one',
      ' *',
      ' * Line two',
      ' */',
      'export const Basic = {',
      '  args: { a: 1 },',
      '};',
    ].join('\r\n');

    const result = await enrich(code, code);

    expect(result).toContain(`originalSource: "{\\n  args: { a: 1 },\\n}"`);
    expect(result).toContain(`story: "Line one\\n\\nLine two"`);
  });

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
    ).toMatchInlineSnapshot(`(args) => <Button {...args} />`);
  });
  it('resolves a constant local function alias', () => {
    expect(
      source(dedent`
        const ParagraphStory = () => <Button />;
        export const Basic = ParagraphStory;
      `)
    ).toMatchInlineSnapshot(`() => <Button />`);
  });
  it.each(['as', 'satisfies'])('resolves an exported alias wrapped in TypeScript %s', (wrapper) => {
    expect(
      source(dedent`
        const ParagraphStory = () => <Button />;
        export const Basic = ParagraphStory ${wrapper} StoryFn;
      `)
    ).toMatchInlineSnapshot(`() => <Button />`);
  });
  it.each(['as', 'satisfies'])('resolves a function alias wrapped in TypeScript %s', (wrapper) => {
    expect(
      source(dedent`
        const ParagraphStory = (() => <Button />) ${wrapper} StoryFn;
        export const Basic = ParagraphStory;
      `)
    ).toMatchInlineSnapshot(`() => <Button />`);
  });
  it('resolves a local function declaration alias', () => {
    expect(
      source(dedent`
        function ParagraphStory() {
          return <Button />;
        }
        export const Basic = ParagraphStory;
      `)
    ).toBe(
      dedent`
        function ParagraphStory() {
          return <Button />;
        }
      `
    );
  });
  it('keeps unresolved identifiers as written', () => {
    expect(
      source(dedent`
        export const Basic = MissingStory;
      `)
    ).toMatchInlineSnapshot(`MissingStory`);
  });
  it('keeps imported identifiers as written', () => {
    expect(
      source(dedent`
        import { ParagraphStory } from './stories';
        export const Basic = ParagraphStory;
      `)
    ).toMatchInlineSnapshot(`ParagraphStory`);
  });
  it.each(['as', 'satisfies'])('preserves wrapped unresolved identifiers for %s', (wrapper) => {
    expect(
      source(dedent`
        export const Basic = MissingStory ${wrapper} StoryFn;
      `)
    ).toBe(`MissingStory ${wrapper} StoryFn`);
  });
  it('keeps mutable local identifiers as written', () => {
    expect(
      source(dedent`
        let ParagraphStory = () => <Button />;
        ParagraphStory = () => <Button primary />;
        export const Basic = ParagraphStory;
      `)
    ).toMatchInlineSnapshot(`ParagraphStory`);
  });
  it('keeps non-function aliases as written', () => {
    expect(
      source(dedent`
        const ParagraphStory = { args: { label: 'text' } };
        export const Basic = ParagraphStory;
      `)
    ).toMatchInlineSnapshot(`ParagraphStory`);
  });
  it.each(['as', 'satisfies'])('preserves wrapped non-function aliases for %s', (wrapper) => {
    expect(
      source(dedent`
        const StoryConfig = { args: { label: 'text' } };
        export const Basic = StoryConfig ${wrapper} StoryFn;
      `)
    ).toBe(`StoryConfig ${wrapper} StoryFn`);
  });
  it('stops circular local aliases', () => {
    expect(
      source(dedent`
        const First = Second;
        const Second = First;
        export const Basic = First;
      `)
    ).toMatchInlineSnapshot(`First`);
  });
  it('supports the existing two-argument API', () => {
    const code = dedent`
      export default { title: 'Button' };
      export const Basic = () => <Button />;
    `;
    const csf = loadCsf(code, { makeTitle: (userTitle) => userTitle }).parse();
    const exportNode = Object.values(csf._storyExports)[0];

    expect(extractSource(exportNode, csf._code)).toBe('() => <Button />');
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
        parameters: { foo: 'bar' }
      }
    `);
  });
});
