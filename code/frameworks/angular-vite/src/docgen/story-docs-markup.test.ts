import { createStoryArgsResolver, loadCsf } from 'storybook/internal/csf-tools';

import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import type { Bindings, StoryShape } from './story-docs-markup.ts';
import { userTemplate } from './story-docs-markup.ts';

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

const templateOf = (source: string, exportName = 'Default') =>
  userTemplate(shapeOf(source, exportName), bindings);

describe('userTemplate', () => {
  it('reads a String.raw template as the markup it spells out', () => {
    expect(
      templateOf(dedent`
        export default { title: 'Example/Button' };
        export const Default = { template: String.raw\`<sb-button>Save</sb-button>\` };
      `)
    ).toEqual({ kind: 'literal', markup: '<sb-button>Save</sb-button>', expandedArgs: [] });
  });

  it('reads a String.raw template the story reaches through a module-level name', () => {
    expect(
      templateOf(dedent`
        const TEMPLATE = String.raw\`<sb-button hoisted></sb-button>\`;
        export default { title: 'Example/Button' };
        export const Default = { template: TEMPLATE };
      `)
    ).toEqual({ kind: 'literal', markup: '<sb-button hoisted></sb-button>', expandedArgs: [] });
  });

  it('reads a String.raw template out of a render function', () => {
    expect(
      templateOf(dedent`
        export default { title: 'Example/Button' };
        export const Default = {
          render: () => ({ template: String.raw\`<sb-button rendered></sb-button>\` }),
        };
      `)
    ).toEqual({ kind: 'literal', markup: '<sb-button rendered></sb-button>', expandedArgs: [] });
  });

  it('keeps a String.raw escape sequence literal instead of cooking it', () => {
    expect(
      templateOf(dedent`
        export default { title: 'Example/Button' };
        export const Default = { template: String.raw\`<sb-button label="a\\nb"></sb-button>\` };
      `)
    ).toEqual({
      kind: 'literal',
      markup: '<sb-button label="a\\nb"></sb-button>',
      expandedArgs: [],
    });
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
    ).toEqual({
      kind: 'literal',
      markup: `<sb-button [label]="'Save'" (pressed)="pressed($event)">Bye</sb-button>`,
      expandedArgs: ['label'],
    });
  });

  it('leaves a template tagged with anything other than String.raw unresolvable', () => {
    expect(
      templateOf(dedent`
        import { html } from 'lit';
        export default { title: 'Example/Button' };
        export const Default = { template: html\`<sb-button></sb-button>\` };
      `)
    ).toEqual({ kind: 'unresolvable', source: 'html`<sb-button></sb-button>`' });
  });
});
