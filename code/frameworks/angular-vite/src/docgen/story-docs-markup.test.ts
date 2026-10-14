import { createStoryArgsResolver, loadCsf } from 'storybook/internal/csf-tools';

import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import type { Bindings, StoryShape } from './story-docs-markup.ts';
import { renderedProps, userTemplate } from './story-docs-markup.ts';
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
    hidingArgs: resolved.unresolved,
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

describe('renderedProps', () => {
  const propsOf = (render: string, names: string[]) => {
    const props = renderedProps(
      shapeOf(
        dedent`
          export default { title: 'Example/Button' };
          export const Default = { ${render} };
        `,
        'Default'
      )
    );
    return props && Object.fromEntries(names.map((name) => [name, describeProp(props(name))]));
  };
  const describeProp = (prop: ReturnType<NonNullable<ReturnType<typeof renderedProps>>>) =>
    prop && [prop.arg, prop.code && 'code'].filter(Boolean).join(' or ');

  it('holds every arg under its own name without a render', () => {
    expect(propsOf(`args: { label: 'Save' }`, ['label', 'other'])).toEqual({
      label: 'label',
      other: 'other',
    });
  });

  it.each([`(args) => ({ props: args })`, `({ ...args }) => ({ props: { ...args } })`])(
    'holds every arg for %s',
    (render) => {
      expect(propsOf(`render: ${render}`, ['label'])).toEqual({ label: 'label' });
    }
  );

  it('holds only the args a render names, under the name it gives them', () => {
    expect(
      propsOf(
        `render: ({ label, size: scale, on = true }) => ({ props: { label, scale, on, id: 1 } })`,
        ['label', 'scale', 'size', 'on', 'id']
      )
    ).toEqual({ label: 'label', scale: 'size', size: undefined, on: 'on or code', id: 'code' });
  });

  it('reads an arg off the args object or a rest of it', () => {
    expect(
      propsOf(
        `render: ({ label, ...rest }) => ({ props: { ...rest, text: rest['size'], label: rest.label } })`,
        ['size', 'text', 'label']
      )
    ).toEqual({ size: 'size', text: 'size', label: 'code' });
  });

  it('lets a spread arg replace a prop written before it, and not one written after', () => {
    expect(
      propsOf(`render: (args) => ({ props: { before: 1, ...args, after: 2 } })`, [
        'before',
        'after',
        'label',
      ])
    ).toEqual({ before: 'before or code', after: 'code', label: 'label' });
  });

  it('holds the code of a prop that reads no arg past a statement handing the args on', () => {
    const render = `render: (args) => { track(args); return { props: { label: 'Fixed', x: [args.label] } }; }`;
    expect(propsOf(render, ['label', 'x'])).toEqual({ label: 'code', x: 'code' });
  });

  it('holds nothing for a render without props', () => {
    expect(propsOf(`render: (args) => ({ template: '<sb-button />' })`, ['label'])).toEqual({
      label: undefined,
    });
  });

  describe('code that reads args', () => {
    const computedOf = (source: string, name: string) => {
      const props = renderedProps(shapeOf(source, 'Default'));
      const computed = props?.(name)?.computed;
      return computed && { code: computed.print((arg) => `«${arg}»`), imports: computed.imports };
    };
    const story = (render: string, header = '') => dedent`
      ${header}
      export default { title: 'Example/Button' };
      export const Default = { render: ${render} };
    `;

    it.each([
      [`(args) => ({ props: { x: args.label + '!' } })`, "«label» + '!'"],
      [
        `({ count }) => ({ props: { x: count > 3 ? 'many' : 'few' } })`,
        "«count» > 3 ? 'many' : 'few'",
      ],
      [
        `(args) => ({ props: { x: { title: 'Hi', label: args.label } } })`,
        "{\n  title: 'Hi',\n  label: «label»,\n}",
      ],
      [`({ label }) => ({ props: { x: { label } } })`, '{\n  label: «label»,\n}'],
      [`(args) => ({ props: { x: args.count.toFixed(1) } })`, '(«count»).toFixed(1)'],
      [`(args) => ({ props: { x: -args.count } })`, '-(«count»)'],
      [`(args) => ({ props: { x: (v) => v + args.label } })`, '(v) => v + «label»'],
      [`(args) => ({ props: { x: () => args.config || {} } })`, '() => («config») || {}'],
      [`(args) => ({ props: { x: () => args.on ? 1 : 2 } })`, '() => («on») ? 1 : 2'],
      [`(args) => ({ props: { x: () => [args.label] } })`, '() => [«label»]'],
    ])('writes each arg read in place in %s', (render, code) => {
      expect(computedOf(story(render), 'x')).toEqual({ code, imports: [] });
    });

    it('imports a type the code names as the story file imports it', () => {
      const render = `(args) => ({ props: { x: new FormControl<Shape>(args.value) } })`;
      const header = dedent`
        import { FormControl } from '@angular/forms';
        import { Shape } from './shape';
      `;
      expect(computedOf(story(render, header), 'x')).toEqual({
        code: 'new FormControl<Shape>(«value»)',
        imports: ['FormControl', 'Shape'],
      });
    });

    it.each([
      ['a name of the story file', `(args) => ({ props: { x: args.label + suffix } })`],
      ['a storybook import', `(args) => ({ props: { x: action(args.label) } })`],
      ['an arg it calls', `(args) => ({ props: { x: args.format(1) } })`],
      ['the args whole', `(args) => ({ props: { x: build(args) } })`],
      ['an arg with a default', `({ label = 'Go' }) => ({ props: { x: label + '!' } })`],
      [
        'a const of the render body',
        `(args) => { const c = [args.label]; return { props: { x: c } }; }`,
      ],
      [
        'a const of the render body it names',
        `(args) => { const c = [args.label]; return { props: { x: { c } } }; }`,
      ],
      ['an arg it calls if set', `(args) => ({ props: { x: () => args.format?.(1) } })`],
      ['an arg it constructs', `(args) => ({ props: { x: new args.Shape(1) } })`],
      ['a type only imported', `(args) => ({ props: { x: build<TypeOnly>(args.label) } })`],
      ['a type of the story file', `(args) => ({ props: { x: build<Local>(args.label) } })`],
      ['no arg', `(args) => ({ props: { x: [1, 2] } })`],
    ])('is left out for code reading %s', (_, render) => {
      const header = dedent`
        import { action } from 'storybook/actions';
        import { build } from './build';
        import type { TypeOnly } from './types';
        const suffix = '!';
        interface Local { a: string }
      `;
      expect(computedOf(story(render, header), 'x')).toBeUndefined();
    });
  });

  it.each([
    `(args) => ({ props: { ...args, ...extra() } })`,
    `(args) => ({ props: build(args) })`,
    `(args) => (args.on ? { props: args } : {})`,
  ])('cannot read the props of %s', (render) => {
    expect(propsOf(`render: ${render}`, ['label'])).toBeUndefined();
  });
});
