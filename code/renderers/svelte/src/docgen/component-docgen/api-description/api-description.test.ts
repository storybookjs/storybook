import { describe, expect, it } from 'vitest';

import type { Docgen, PropInfo } from '../svelte2tsx/generate-docgen.ts';
import { buildApiDescription } from './api-description.ts';

const prop = (overrides: Pick<PropInfo, 'name' | 'typeText'> & Partial<PropInfo>): PropInfo => ({
  optional: false,
  ...overrides,
});

const docgen = (overrides: Partial<Docgen>): Docgen => ({ props: [], ...overrides });

describe('buildApiDescription', () => {
  it('returns undefined for a component without props, events or slots', () => {
    expect(buildApiDescription('Button', docgen({ events: [], slots: [] }))).toBeUndefined();
  });

  it('keeps `undefined` in the type of a required prop and unwraps only whole-type parentheses', () => {
    const result = buildApiDescription(
      'Button',
      docgen({
        props: [
          prop({ name: 'value', typeText: 'string | undefined' }),
          prop({
            name: 'render',
            typeText: '(() => void) | (() => string) | undefined',
            optional: true,
          }),
        ],
      })
    );
    expect(result).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type ButtonProps = {
        value: string | undefined;
        render?: (() => void) | (() => string);
      }
      \`\`\`"
    `);
  });

  it('keeps multiline descriptions and examples in a multiline doc comment', () => {
    const result = buildApiDescription(
      'Button',
      docgen({
        props: [
          prop({
            name: 'label',
            typeText: 'string',
            description: 'Text on the button.\nKeep it short.',
            jsDocTags: [
              { name: 'example', text: '<Button label="Save" />\n<Button label="Undo" />' },
            ],
          }),
        ],
      })
    );
    expect(result).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type ButtonProps = {
        /**
         * Text on the button.
         * Keep it short.
         *
         * @example <Button label="Save" />
         * <Button label="Undo" />
         */
        label: string;
      }
      \`\`\`"
    `);
  });

  it("leaves out a JS component's `@type` tag and a default the extractor could not print", () => {
    const result = buildApiDescription(
      'Accordion',
      docgen({
        props: [
          prop({
            name: 'id',
            typeText: 'string | undefined',
            optional: true,
            description: 'Unique ID of the accordion.',
            defaultValue: { text: '...' },
            jsDocTags: [{ name: 'type', text: '{string}' }],
          }),
        ],
      })
    );
    expect(result).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type AccordionProps = {
        /** Unique ID of the accordion. */
        id?: string;
      }
      \`\`\`"
    `);
  });

  it('prints a multiline default on one line', () => {
    const result = buildApiDescription(
      'FileInput',
      docgen({
        props: [
          prop({
            name: 'accept',
            typeText: 'string[] | undefined',
            optional: true,
            defaultValue: { text: "[\n  'image/*',\n  'text/*'\n]" },
          }),
        ],
      })
    );
    expect(result).toContain("accept?: string[] = [ 'image/*', 'text/*' ];");
  });

  it('drops the line comments of a multiline default, which would swallow the rest of the line', () => {
    const result = buildApiDescription(
      'Sizes',
      docgen({
        props: [
          prop({
            name: 'sizes',
            typeText: 'string[] | undefined',
            optional: true,
            defaultValue: { text: "[\n  'sm', // small\n  'https://x',\n]" },
            jsDocTags: [{ name: 'bindable', text: '' }],
          }),
        ],
      })
    );
    expect(result).toContain("sizes?: string[] = [ 'sm', 'https://x', ]; // bind:sizes={...}");
  });

  it('prints no `@default` when the extractor found a default it cannot print, as the props table does', () => {
    const result = buildApiDescription(
      'Field',
      docgen({
        props: [
          prop({
            name: 'id',
            typeText: 'string | undefined',
            optional: true,
            defaultValue: { text: '...' },
            jsDocTags: [{ name: 'default', text: 'an auto-generated id' }],
          }),
        ],
      })
    );
    expect(result).toContain('  id?: string;\n');
  });

  it('uses only the attribute types when they bring all the props', () => {
    const result = buildApiDescription(
      'Button',
      docgen({ omittedTypes: ['HTMLButtonAttributes'] })
    );
    expect(result).toMatchInlineSnapshot(`
      "## Props

      \`\`\`
      export type ButtonProps = HTMLButtonAttributes
      \`\`\`"
    `);
  });

  it('types each slot with the props it passes to its content', () => {
    const result = buildApiDescription(
      'List',
      docgen({
        slots: [
          { name: 'default', typeText: '{ item: string; index: number; }' },
          { name: 'empty-state', description: 'Shown when the list is empty.', typeText: '{}' },
        ],
      })
    );
    expect(result).toMatchInlineSnapshot(`
      "## Slots

      Each slot is typed with the props it passes to its content.

      \`\`\`
      export type ListSlots = {
        default: { item: string; index: number; };
        /** Shown when the list is empty. */
        "empty-state": {};
      }
      \`\`\`"
    `);
  });

  it('names the types after a component name that is not an identifier', () => {
    const result = buildApiDescription(
      '3d-viewer',
      docgen({ props: [prop({ name: 'model', typeText: 'string' })] })
    );
    expect(result).toContain('export type Component3dviewerProps = {');
  });
});
