import { createStoryArgsResolver, loadCsf } from 'storybook/internal/csf-tools';

import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import type { Bindings, StoryShape } from './story-docs-markup.ts';
import { userTemplate } from './story-docs-markup.ts';
import { analyzeStoryTemplate } from './story-docs-template-analysis.ts';

const shapeOf = (source: string, exportName: string): StoryShape => {
  const csf = loadCsf(source, { makeTitle: () => 'Example/Button' }).parse();
  const resolved = createStoryArgsResolver(csf).resolve(exportName);
  return {
    csf,
    exportName,
    members: resolved.storyMembers,
    metaMembers: resolved.metaMembers,
    args: resolved.args,
    unresolvedArgs: resolved.unresolved,
  };
};

const bindings: Bindings = {
  inputs: [{ name: 'label', expression: "'Save'" }],
  outputs: ['pressed'],
};

const templateOf = (
  source: string,
  exportName = 'Default',
  templateBindings: Bindings = bindings
) => {
  const template = userTemplate(shapeOf(source, exportName), templateBindings);
  if (template?.kind !== 'literal') {
    return template;
  }
  const analysis = analyzeStoryTemplate(template.markup, template.expansions);
  if (analysis.kind === 'unresolvable') {
    throw new Error(analysis.errors.join('\n'));
  }
  return {
    kind: template.kind,
    markup: analysis.markup,
    representedArgs: template.representedArgs,
  };
};

describe('userTemplate', () => {
  it('reads a String.raw template as the markup it spells out', () => {
    expect(
      templateOf(dedent`
        export default { title: 'Example/Button' };
        export const Default = { template: String.raw\`<sb-button>Save</sb-button>\` };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "literal",
        "markup": "<sb-button>Save</sb-button>",
        "representedArgs": [],
      }
    `);
  });

  it('reads a String.raw template the story reaches through a module-level name', () => {
    expect(
      templateOf(dedent`
        const TEMPLATE = String.raw\`<sb-button hoisted></sb-button>\`;
        export default { title: 'Example/Button' };
        export const Default = { template: TEMPLATE };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "literal",
        "markup": "<sb-button hoisted></sb-button>",
        "representedArgs": [],
      }
    `);
  });

  it('reads a String.raw template out of a render function', () => {
    expect(
      templateOf(dedent`
        export default { title: 'Example/Button' };
        export const Default = {
          render: () => ({ template: String.raw\`<sb-button rendered></sb-button>\` }),
        };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "literal",
        "markup": "<sb-button rendered></sb-button>",
        "representedArgs": [],
      }
    `);
  });

  it('keeps a String.raw escape sequence literal instead of cooking it', () => {
    expect(
      templateOf(dedent`
        export default { title: 'Example/Button' };
        export const Default = { template: String.raw\`<sb-button label="a\\nb"></sb-button>\` };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "literal",
        "markup": "<sb-button label="a\\nb"></sb-button>",
        "representedArgs": [],
      }
    `);
  });

  it('substitutes into a String.raw template the same way it does a plain one', () => {
    expect(
      templateOf(dedent`
        import { argsToTemplate } from '@storybook/angular-vite';
        const FOOTER = 'Bye';
        export default { title: 'Example/Button' };
        export const Default = {
          args: { label: 'Save' },
          render: (args) => ({
            props: args,
            template: String.raw\`<sb-button \${argsToTemplate(args)}>\${FOOTER}</sb-button>\`,
          }),
        };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "literal",
        "markup": "<sb-button [label]="'Save'" (pressed)="pressed($event)">Bye</sb-button>",
        "representedArgs": [
          "label",
          "pressed",
        ],
      }
    `);
  });

  it('does not duplicate an included output already bound on the interpolation element', () => {
    expect(
      templateOf(dedent`
        import { argsToTemplate } from '@storybook/angular-vite';
        export default { title: 'Example/Button' };
        export const Default = {
          render: (args) => ({
            props: args,
            template: \`<sb-button \${argsToTemplate(args, { include: ['pressed'] })} (pressed)="manual($event)"></sb-button>\`,
          }),
        };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "literal",
        "markup": "<sb-button (pressed)="manual($event)"></sb-button>",
        "representedArgs": [
          "pressed",
        ],
      }
    `);
  });

  it('records an interpolated parameter as represented when it substitutes its arg value', () => {
    expect(
      templateOf(dedent`
        export default { title: 'Example/Button' };
        export const Default = {
          args: { footer: 'Bye' },
          render: ({ footer }) => ({ template: \`<sb-button>\${footer}</sb-button>\` }),
        };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "literal",
        "markup": "<sb-button>Bye</sb-button>",
        "representedArgs": [
          "footer",
        ],
      }
    `);
  });

  it('maps a renamed destructured parameter back to its source arg', () => {
    expect(
      templateOf(dedent`
        export default { title: 'Example/Button' };
        export const Default = {
          args: { label: 'Save', text: 'Wrong' },
          render: ({ label: text }) => ({ template: \`<sb-button>\${text}</sb-button>\` }),
        };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "literal",
        "markup": "<sb-button>Save</sb-button>",
        "representedArgs": [
          "label",
        ],
      }
    `);
  });

  it('does not guess which arg a computed destructuring key reads', () => {
    expect(
      templateOf(dedent`
        const key = 'label';
        const text = 'module value';
        export default { title: 'Example/Button' };
        export const Default = {
          args: { label: 'Save' },
          render: ({ [key]: text }) => ({ template: \`<sb-button>\${text}</sb-button>\` }),
        };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "unresolvable",
        "source": "\`<sb-button>\${text}</sb-button>\`",
      }
    `);
  });

  it('does not treat the render context parameter as story args', () => {
    expect(
      templateOf(dedent`
        const context = 'module value';
        export default { title: 'Example/Button' };
        export const Default = {
          args: { context: 'ARG' },
          render: (args, context) => ({ template: \`<sb-button>\${context}</sb-button>\` }),
        };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "unresolvable",
        "source": "\`<sb-button>\${context}</sb-button>\`",
      }
    `);
  });

  it('does not replace a local helper that shadows the imported argsToTemplate', () => {
    expect(
      templateOf(dedent`
        import { argsToTemplate } from '@storybook/angular-vite';
        export default { title: 'Example/Button' };
        export const Default = {
          args: { label: 'Save' },
          render: (args) => {
            const argsToTemplate = () => 'custom';
            return { template: \`<sb-button \${argsToTemplate(args)}></sb-button>\` };
          },
        };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "unresolvable",
        "source": "\`<sb-button \${argsToTemplate(args)}></sb-button>\`",
      }
    `);
  });

  it('leaves a template tagged with anything other than String.raw unresolvable', () => {
    expect(
      templateOf(dedent`
        import { html } from 'lit';
        export default { title: 'Example/Button' };
        export const Default = { template: html\`<sb-button></sb-button>\` };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "unresolvable",
        "source": "html\`<sb-button></sb-button>\`",
      }
    `);
  });
});
