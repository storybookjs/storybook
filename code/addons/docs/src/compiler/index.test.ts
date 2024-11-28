import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { compile, compileSync } from './index';

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? val : val.toString()),
  test: (_val) => true,
});

// Remove unnecessary noise from snapshots
const clean = (code: string) => {
  const mdxContentRegex =
    /export default function MDXContent\([^)]*\) \{(?:[^{}]*|{(?:[^{}]*|{[^{}]*})*})*\}/gs;

  const mdxMissingReferenceRegex =
    /function _missingMdxReference\([^)]*\) \{(?:[^{}{}]*|{(?:[^{}{}]*|{[^{}{}]*?})*?})*?\}/gs;

  return code.replace(mdxMissingReferenceRegex, '').replace(mdxContentRegex, '');
};

describe('mdx3', () => {
  it('supports AdjacentBlockJSX', () => {
    const input = dedent`
      <style>{\`
        h1 {
          color: blue;
        }
      \`}</style>
   `;

    expect(clean(compileSync(input))).toMatchInlineSnapshot(`
      import {jsx as _jsx} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      function _createMdxContent(props) {
        return _jsx("style", {
          children: \`
        h1 {
          color: blue;
        }
      \`
        });
      }
    `);
  });

  it('supports Await in MDX', () => {
    const input = dedent`
      {await Promise.resolve('Hello World')}
   `;

    expect(clean(compileSync(input))).toMatchInlineSnapshot(`
      import {Fragment as _Fragment, jsx as _jsx} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      async function _createMdxContent(props) {
        return _jsx(_Fragment, {
          children: await Promise.resolve('Hello World')
        });
      }
    `);
  });

  it('supports ES2024', () => {
    const input = dedent`
    export const obj = {
      nested: {
        property: 'Hello world!'
      }
    };
    
    export const value = obj?.nested?.property ?? 'Default Value';
    
    Value: {value}
   `;

    expect(clean(compileSync(input))).toMatchInlineSnapshot(`
      import {jsx as _jsx, jsxs as _jsxs} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      export const obj = {
        nested: {
          property: 'Hello world!'
        }
      };
      export const value = obj?.nested?.property ?? 'Default Value';
      function _createMdxContent(props) {
        const _components = {
          p: "p",
          ..._provideComponents(),
          ...props.components
        };
        return _jsxs(_components.p, {
          children: ["Value: ", value]
        });
      }
    `);
  });
});

describe('mdx2', () => {
  it('works', () => {
    const input = dedent`
      # hello

      <Meta title="foobar" />

      world {2 + 1}
    `;

    expect(clean(compileSync(input))).toMatchInlineSnapshot(`
      import {Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      function _createMdxContent(props) {
        const _components = {
          h1: "h1",
          p: "p",
          ..._provideComponents(),
          ...props.components
        }, {Meta} = _components;
        if (!Meta) _missingMdxReference("Meta", true);
        return _jsxs(_Fragment, {
          children: [_jsx(_components.h1, {
            children: "hello"
          }), "\\n", _jsx(Meta, {
            title: "foobar"
          }), "\\n", _jsxs(_components.p, {
            children: ["world ", 2 + 1]
          })]
        });
      }
    `);
  });

  it('standalone jsx expressions', () => {
    expect(
      clean(
        compileSync(dedent`
        # Standalone JSX expressions

        {3 + 3}
      `)
      )
    ).toMatchInlineSnapshot(`
      import {Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      function _createMdxContent(props) {
        const _components = {
          h1: "h1",
          ..._provideComponents(),
          ...props.components
        };
        return _jsxs(_Fragment, {
          children: [_jsx(_components.h1, {
            children: "Standalone JSX expressions"
          }), "\\n", 3 + 3]
        });
      }
    `);
  });
});

describe('full snapshots', () => {
  it('compileSync', () => {
    const input = dedent`
      # hello

      <Meta title="foobar" />

      world {2 + 1}
    `;

    expect(compileSync(input)).toMatchInlineSnapshot(`
      import {Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      function _createMdxContent(props) {
        const _components = {
          h1: "h1",
          p: "p",
          ..._provideComponents(),
          ...props.components
        }, {Meta} = _components;
        if (!Meta) _missingMdxReference("Meta", true);
        return _jsxs(_Fragment, {
          children: [_jsx(_components.h1, {
            children: "hello"
          }), "\\n", _jsx(Meta, {
            title: "foobar"
          }), "\\n", _jsxs(_components.p, {
            children: ["world ", 2 + 1]
          })]
        });
      }
      export default function MDXContent(props = {}) {
        const {wrapper: MDXLayout} = {
          ..._provideComponents(),
          ...props.components
        };
        return MDXLayout ? _jsx(MDXLayout, {
          ...props,
          children: _jsx(_createMdxContent, {
            ...props
          })
        }) : _createMdxContent(props);
      }
      function _missingMdxReference(id, component) {
        throw new Error("Expected " + (component ? "component" : "object") + " \`" + id + "\` to be defined: you likely forgot to import, pass, or provide it.");
      }
    `);
  });
  it('compile', async () => {
    const input = dedent`
      # hello

      <Meta title="foobar" />

      world {2 + 1}
    `;

    expect(await compile(input)).toMatchInlineSnapshot(`
      import {Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      function _createMdxContent(props) {
        const _components = {
          h1: "h1",
          p: "p",
          ..._provideComponents(),
          ...props.components
        }, {Meta} = _components;
        if (!Meta) _missingMdxReference("Meta", true);
        return _jsxs(_Fragment, {
          children: [_jsx(_components.h1, {
            children: "hello"
          }), "\\n", _jsx(Meta, {
            title: "foobar"
          }), "\\n", _jsxs(_components.p, {
            children: ["world ", 2 + 1]
          })]
        });
      }
      export default function MDXContent(props = {}) {
        const {wrapper: MDXLayout} = {
          ..._provideComponents(),
          ...props.components
        };
        return MDXLayout ? _jsx(MDXLayout, {
          ...props,
          children: _jsx(_createMdxContent, {
            ...props
          })
        }) : _createMdxContent(props);
      }
      function _missingMdxReference(id, component) {
        throw new Error("Expected " + (component ? "component" : "object") + " \`" + id + "\` to be defined: you likely forgot to import, pass, or provide it.");
      }
    `);
  });
  it('sync & async should match', async () => {
    const input = dedent`
    # hello

    <Meta title="foobar" />

    world {2 + 1}
  `;

    const ou1 = compileSync(input);
    const ou2 = await compile(input);

    expect(ou1).toEqual(ou2);
  });
  it('canvas without story children', () => {
    const input = dedent`
      import { Canvas } from '@storybook/addon-docs';

      <Canvas>
        <h2>Some here</h2>
      </Canvas>
    `;
    expect(compileSync(input)).toMatchInlineSnapshot(`
      import {jsx as _jsx} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      import {Canvas} from '@storybook/addon-docs';
      function _createMdxContent(props) {
        return _jsx(Canvas, {
          children: _jsx("h2", {
            children: "Some here"
          })
        });
      }
      export default function MDXContent(props = {}) {
        const {wrapper: MDXLayout} = {
          ..._provideComponents(),
          ...props.components
        };
        return MDXLayout ? _jsx(MDXLayout, {
          ...props,
          children: _jsx(_createMdxContent, {
            ...props
          })
        }) : _createMdxContent(props);
      }
    `);
  });
});

describe('docs-mdx-compiler-plugin', () => {
  it('csf-imports.mdx', () => {
    expect(
      clean(
        compileSync(dedent`
        import { Story, Meta, Canvas } from '@storybook/addon-docs';
        import { Welcome, Button } from '@storybook/angular/demo';
        import * as MyStories from './My.stories';
        import { Other } from './Other.stories';

        <Meta title="MDX/CSF imports" />

        # Stories from CSF imports

        <Story of={MyStories.Basic} />

        <Canvas>
          <Story of={Other} />
        </Canvas>
      `)
      )
    ).toMatchInlineSnapshot(`
      import {Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      import {Story, Meta, Canvas} from '@storybook/addon-docs';
      import {Welcome, Button} from '@storybook/angular/demo';
      import * as MyStories from './My.stories';
      import {Other} from './Other.stories';
      function _createMdxContent(props) {
        const _components = {
          h1: "h1",
          ..._provideComponents(),
          ...props.components
        };
        return _jsxs(_Fragment, {
          children: [_jsx(Meta, {
            title: "MDX/CSF imports"
          }), "\\n", _jsx(_components.h1, {
            children: "Stories from CSF imports"
          }), "\\n", _jsx(Story, {
            of: MyStories.Basic
          }), "\\n", _jsx(Canvas, {
            children: _jsx(Story, {
              of: Other
            })
          })]
        });
      }
    `);
  });

  it('docs-only.mdx', () => {
    expect(
      clean(
        compileSync(dedent`
        import { Meta } from '@storybook/addon-docs';

        <Meta title="docs-only" />

        # Documentation only

        This is a documentation-only MDX file which cleans a dummy 'docsOnly: true' story.
      `)
      )
    ).toMatchInlineSnapshot(`
      import {Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      import {Meta} from '@storybook/addon-docs';
      function _createMdxContent(props) {
        const _components = {
          h1: "h1",
          p: "p",
          ..._provideComponents(),
          ...props.components
        };
        return _jsxs(_Fragment, {
          children: [_jsx(Meta, {
            title: "docs-only"
          }), "\\n", _jsx(_components.h1, {
            children: "Documentation only"
          }), "\\n", _jsx(_components.p, {
            children: "This is a documentation-only MDX file which cleans a dummy 'docsOnly: true' story."
          })]
        });
      }
    `);
  });

  it('meta-quotes-in-title.mdx', () => {
    expect(
      clean(
        compileSync(dedent`
        import { Meta } from '@storybook/addon-docs';

        <Meta title="Addons/Docs/what's in a title?" />
      `)
      )
    ).toMatchInlineSnapshot(`
      import {jsx as _jsx} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      import {Meta} from '@storybook/addon-docs';
      function _createMdxContent(props) {
        return _jsx(Meta, {
          title: "Addons/Docs/what's in a title?"
        });
      }
    `);
  });

  it('non-story-exports.mdx', () => {
    expect(
      clean(
        compileSync(dedent`
        import { Button } from '@storybook/react/demo';
        import { Story, Meta } from '@storybook/addon-docs';

        <Meta title="Button" />

        # Story definition

        <Story of={Button} />

        export const two = 2;
      `)
      )
    ).toMatchInlineSnapshot(`
      import {Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      import {Button} from '@storybook/react/demo';
      import {Story, Meta} from '@storybook/addon-docs';
      export const two = 2;
      function _createMdxContent(props) {
        const _components = {
          h1: "h1",
          ..._provideComponents(),
          ...props.components
        };
        return _jsxs(_Fragment, {
          children: [_jsx(Meta, {
            title: "Button"
          }), "\\n", _jsx(_components.h1, {
            children: "Story definition"
          }), "\\n", _jsx(Story, {
            of: Button
          })]
        });
      }
    `);
  });

  it('story-current.mdx', () => {
    expect(
      clean(
        compileSync(dedent`
        import { Story } from '@storybook/addon-docs';

        # Current story

        <Story id="." />
      `)
      )
    ).toMatchInlineSnapshot(`
      import {Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      import {Story} from '@storybook/addon-docs';
      function _createMdxContent(props) {
        const _components = {
          h1: "h1",
          ..._provideComponents(),
          ...props.components
        };
        return _jsxs(_Fragment, {
          children: [_jsx(_components.h1, {
            children: "Current story"
          }), "\\n", _jsx(Story, {
            id: "."
          })]
        });
      }
    `);
  });

  it('story-references.mdx', () => {
    expect(
      clean(
        compileSync(dedent`
        import { Story } from '@storybook/addon-docs';

        # Story reference

        <Story id="welcome--welcome" />
      `)
      )
    ).toMatchInlineSnapshot(`
      import {Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      import {Story} from '@storybook/addon-docs';
      function _createMdxContent(props) {
        const _components = {
          h1: "h1",
          ..._provideComponents(),
          ...props.components
        };
        return _jsxs(_Fragment, {
          children: [_jsx(_components.h1, {
            children: "Story reference"
          }), "\\n", _jsx(Story, {
            id: "welcome--welcome"
          })]
        });
      }
    `);
  });

  it('title-template-string.mdx', () => {
    expect(
      clean(
        compileSync(
          [
            "import { Meta, Story } from '@storybook/addon-docs';",
            "import { titleFunction } from '../title-generators';",
            '',

            "<Meta title={`${titleFunction('template')}`} />",
          ].join('\n')
        )
      )
    ).toMatchInlineSnapshot(`
      import {jsx as _jsx} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      import {Meta, Story} from '@storybook/addon-docs';
      import {titleFunction} from '../title-generators';
      function _createMdxContent(props) {
        return _jsx(Meta, {
          title: \`\${titleFunction('template')}\`
        });
      }
    `);
  });

  describe('csf3', () => {
    it('auto-title-docs-only.mdx', () => {
      expect(
        clean(
          compileSync(dedent`
          import { Meta } from '@storybook/addon-docs';

          <Meta />

          # Auto-title Docs Only

          Some **markdown** here!
        `)
        )
      ).toMatchInlineSnapshot(`
        import {Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs} from "react/jsx-runtime";
        import {useMDXComponents as _provideComponents} from "@mdx-js/react";
        import {Meta} from '@storybook/addon-docs';
        function _createMdxContent(props) {
          const _components = {
            h1: "h1",
            p: "p",
            strong: "strong",
            ..._provideComponents(),
            ...props.components
          };
          return _jsxs(_Fragment, {
            children: [_jsx(Meta, {}), "\\n", _jsx(_components.h1, {
              children: "Auto-title Docs Only"
            }), "\\n", _jsxs(_components.p, {
              children: ["Some ", _jsx(_components.strong, {
                children: "markdown"
              }), " here!"]
            })]
          });
        }
      `);
    });

    it('auto-title.mdx', () => {
      expect(
        clean(
          compileSync(dedent`
          import { Button } from '@storybook/react/demo';
          import { Story, Meta } from '@storybook/addon-docs';

          <Meta component={Button} />
        `)
        )
      ).toMatchInlineSnapshot(`
        import {jsx as _jsx} from "react/jsx-runtime";
        import {useMDXComponents as _provideComponents} from "@mdx-js/react";
        import {Button} from '@storybook/react/demo';
        import {Story, Meta} from '@storybook/addon-docs';
        function _createMdxContent(props) {
          return _jsx(Meta, {
            component: Button
          });
        }
      `);
    });
  });

  it('style tag', () => {
    expect(
      clean(
        compileSync(dedent`
        import { Meta } from '@storybook/addon-docs';

        <Meta title="Example/Introduction" />

        <style>{\`
          .subheading {
            --mediumdark: '#999999';
            font-weight: 900;
            font-size: 13px;
            color: #999;
            letter-spacing: 6px;
            line-height: 24px;
            text-transform: uppercase;
            margin-bottom: 12px;
            margin-top: 40px;
          }
          .link-list {
            display: grid;
            grid-template-columns: 1fr;
            grid-template-rows: 1fr 1fr;
            row-gap: 10px;
          }
        \`}</style>
      `)
      )
    ).toMatchInlineSnapshot(`
      import {Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs} from "react/jsx-runtime";
      import {useMDXComponents as _provideComponents} from "@mdx-js/react";
      import {Meta} from '@storybook/addon-docs';
      function _createMdxContent(props) {
        return _jsxs(_Fragment, {
          children: [_jsx(Meta, {
            title: "Example/Introduction"
          }), "\\n", _jsx("style", {
            children: \`
        .subheading {
          --mediumdark: '#999999';
          font-weight: 900;
          font-size: 13px;
          color: #999;
          letter-spacing: 6px;
          line-height: 24px;
          text-transform: uppercase;
          margin-bottom: 12px;
          margin-top: 40px;
        }
        .link-list {
          display: grid;
          grid-template-columns: 1fr;
          grid-template-rows: 1fr 1fr;
          row-gap: 10px;
        }
      \`
          })]
        });
      }
    `);
  });
});
