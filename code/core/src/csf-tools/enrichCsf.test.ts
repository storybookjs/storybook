/* eslint-disable no-underscore-dangle */
import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { formatCsf, loadCsf } from './CsfFile';
import type { EnrichCsfOptions } from './enrichCsf';
import { enrichCsf, extractSource } from './enrichCsf';

expect.addSnapshotSerializer({
  print: (val: any) => val.replace(/\\r\\n/gm, '\\n'),
  test: () => true,
});

const enrich = (code: string, originalCode: string, options?: EnrichCsfOptions) => {
  // we don't actually care about the title

  const csf = loadCsf(code, {
    makeTitle: (userTitle) => userTitle || 'default',
  }).parse();
  const csfSource = loadCsf(originalCode, {
    makeTitle: (userTitle) => userTitle || 'default',
  }).parse();
  enrichCsf(csf, csfSource, options);
  return formatCsf(csf);
};

describe('enrichCsf', () => {
  describe('source', () => {
    it('csf1', () => {
      expect(
        enrich(
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
    it('csf2', () => {
      expect(
        enrich(
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
    it('csf3', () => {
      expect(
        enrich(
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
    it('multiple stories', () => {
      expect(
        enrich(
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
    it('skips inline comments', () => {
      expect(
        enrich(
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

    it('skips blocks without jsdoc', () => {
      expect(
        enrich(
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

    it('JSDoc single-line', () => {
      expect(
        enrich(
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

    it('JSDoc multi-line', () => {
      expect(
        enrich(
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

    it('preserves indentation', () => {
      expect(
        enrich(
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
    it('skips inline comments', () => {
      expect(
        enrich(
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

    it('skips blocks without jsdoc', () => {
      expect(
        enrich(
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

    it('JSDoc single-line', () => {
      expect(
        enrich(
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

    it('JSDoc multi-line', () => {
      expect(
        enrich(
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

    it('preserves indentation', () => {
      expect(
        enrich(
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

    it('correctly interleaves parameters', () => {
      expect(
        enrich(
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

    it('respects user component description', () => {
      expect(
        enrich(
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

    it('respects meta variables', () => {
      expect(
        enrich(
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
    it('disableSource', () => {
      expect(
        enrich(
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

    it('disableDescription', () => {
      expect(
        enrich(
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

    it('disable all', () => {
      expect(
        enrich(
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
