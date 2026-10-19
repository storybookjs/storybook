import type { StrictArgTypes } from 'storybook/internal/types';

import { describe, expect, it } from 'vitest';

import { buildApiDescription } from './api-description.ts';

const argTypes = (entries: Record<string, unknown>) => entries as StrictArgTypes;

describe('buildApiDescription', () => {
  it('renders inputs and outputs as their own sections', () => {
    const result = buildApiDescription(
      argTypes({
        label: {
          name: 'label',
          description: 'Text on the button.',
          type: { name: 'string' },
          table: {
            category: 'inputs',
            type: { summary: 'string' },
            defaultValue: { summary: "'Click me'" },
          },
        },
        disabled: {
          name: 'disabled',
          type: { name: 'boolean', required: true },
          table: { category: 'inputs', type: { summary: 'boolean' } },
        },
        clicked: {
          name: 'clicked',
          description: 'Fires on every click.',
          table: { category: 'outputs', type: { summary: 'EventEmitter<Event>' } },
        },
      }),
      'ButtonComponent'
    );

    expect(result).toMatchInlineSnapshot(`
      "## Inputs

      \`\`\`
      export type ButtonComponentInputs = {
        /**
         * Text on the button.
         *
         * @default 'Click me'
         */
        label?: string;
        disabled: boolean;
      }
      \`\`\`

      ## Outputs

      \`\`\`
      export type ButtonComponentOutputs = {
        /** Fires on every click. */
        clicked: EventEmitter<Event>;
      }
      \`\`\`"
    `);
  });

  it('marks an input two-way when the component emits its `Change` output', () => {
    const result = buildApiDescription(
      argTypes({
        color: {
          name: 'color',
          description: 'The currently selected colour',
          table: {
            category: 'inputs',
            type: { summary: 'string' },
            defaultValue: { summary: "'#345F92'" },
          },
        },
        colorChange: {
          name: 'colorChange',
          table: { category: 'outputs', type: { summary: '(e: string) => void' } },
        },
      }),
      'ColorPickerComponent'
    );

    expect(result).toMatchInlineSnapshot(`
      "## Inputs

      \`\`\`
      export type ColorPickerComponentInputs = {
        /**
         * The currently selected colour
         *
         * @default '#345F92'
         */
        color?: string; // two-way: [(color)]
      }
      \`\`\`

      ## Outputs

      \`\`\`
      export type ColorPickerComponentOutputs = {
        colorChange: (e: string) => void;
      }
      \`\`\`"
    `);
  });

  it('leaves an input alone when the `Change` output is another input', () => {
    const result = buildApiDescription(
      argTypes({
        color: {
          name: 'color',
          type: { name: 'string', required: true },
          table: { category: 'inputs', type: { summary: 'string' } },
        },
        colorChange: {
          name: 'colorChange',
          type: { name: 'boolean', required: true },
          table: { category: 'inputs', type: { summary: 'boolean' } },
        },
      }),
      'ColorPickerComponent'
    );

    expect(result).not.toContain('two-way');
  });

  it('omits a section that has no members', () => {
    const result = buildApiDescription(
      argTypes({
        clicked: {
          name: 'clicked',
          table: { category: 'outputs', type: { summary: 'EventEmitter<void>' } },
        },
      }),
      'ButtonComponent'
    );

    expect(result).toContain('## Outputs');
    expect(result).not.toContain('## Inputs');
  });

  it('reports nothing to document when no member is bindable from a template', () => {
    const result = buildApiDescription(
      argTypes({
        elementRef: {
          name: 'elementRef',
          type: { name: 'other', value: 'ElementRef' },
          table: { category: 'properties', type: { summary: 'ElementRef' } },
        },
        focus: {
          name: 'focus',
          table: { category: 'methods', type: { summary: 'focus()' } },
        },
      }),
      'ButtonComponent'
    );

    expect(result).toBeUndefined();
  });

  it('reports nothing to document for a component with no members at all', () => {
    expect(buildApiDescription(argTypes({}), 'ButtonComponent')).toBeUndefined();
  });

  it('keeps the emitted type name a valid identifier', () => {
    const result = buildApiDescription(
      argTypes({
        label: {
          name: 'label',
          type: { name: 'string', required: true },
          table: { category: 'inputs', type: { summary: 'string' } },
        },
      }),
      'My Button.Component'
    );

    expect(result).toContain('export type MyButtonComponentInputs = {');
  });

  it('indents a multi-line description inside the doc comment', () => {
    const result = buildApiDescription(
      argTypes({
        label: {
          name: 'label',
          description: 'Text on the button.\n\nSupports **markdown**.',
          type: { name: 'string', required: true },
          table: { category: 'inputs', type: { summary: 'string' } },
        },
      }),
      'ButtonComponent'
    );

    expect(result).toMatchInlineSnapshot(`
      "## Inputs

      \`\`\`
      export type ButtonComponentInputs = {
        /**
         * Text on the button.
         *
         * Supports **markdown**.
         */
        label: string;
      }
      \`\`\`"
    `);
  });

  it('keeps a default-only doc comment on one line', () => {
    const result = buildApiDescription(
      argTypes({
        size: {
          name: 'size',
          table: {
            category: 'inputs',
            type: { summary: 'number' },
            defaultValue: { summary: '42' },
          },
        },
      }),
      'ButtonComponent'
    );

    expect(result).toMatchInlineSnapshot(`
      "## Inputs

      \`\`\`
      export type ButtonComponentInputs = {
        /** @default 42 */
        size?: number;
      }
      \`\`\`"
    `);
  });

  it('spells an empty-string default as quotes instead of a dangling @default', () => {
    const result = buildApiDescription(
      argTypes({
        label: {
          name: 'label',
          table: {
            category: 'inputs',
            type: { summary: 'string' },
            defaultValue: { summary: '' },
          },
        },
      }),
      'ButtonComponent'
    );

    expect(result).toMatchInlineSnapshot(`
      "## Inputs

      \`\`\`
      export type ButtonComponentInputs = {
        /** @default '' */
        label?: string;
      }
      \`\`\`"
    `);
  });

  it('escapes a comment terminator inside a kept string default', () => {
    const result = buildApiDescription(
      argTypes({
        pattern: {
          name: 'pattern',
          table: {
            category: 'inputs',
            type: { summary: 'string' },
            defaultValue: { summary: "'**/*.ts'" },
          },
        },
      }),
      'GlobComponent'
    );

    expect(result).toContain(`  /** @default '**\\/*.ts' */`);
    expect(result).toContain('  pattern?: string;');
    expect(result?.match(/\*\//g)).toHaveLength(1);
  });

  it('keeps the doc-comment margin on every line of a multi-line default', () => {
    const result = buildApiDescription(
      argTypes({
        config: {
          name: 'config',
          table: {
            category: 'inputs',
            type: { summary: 'Config' },
            defaultValue: { summary: '{\n  depth: 1,\n}' },
          },
        },
      }),
      'TreeComponent'
    );

    expect(result).toMatchInlineSnapshot(`
      "## Inputs

      \`\`\`
      export type TreeComponentInputs = {
        /**
         * @default {
         *   depth: 1,
         * }
         */
        config?: Config;
      }
      \`\`\`"
    `);
  });

  it('renders @deprecated from the member jsDocTags into the doc comment', () => {
    const result = buildApiDescription(
      argTypes({
        clrFlashDanger: {
          name: 'clrFlashDanger',
          description: 'Displays the danger flash.',
          table: {
            category: 'inputs',
            jsDocTags: { deprecated: 'since 2.0, remove in 4.0' },
            type: { summary: 'boolean | string' },
            defaultValue: { summary: 'false' },
          },
        },
      }),
      'ClrProgressBar'
    );

    expect(result).toMatchInlineSnapshot(`
      "## Inputs

      \`\`\`
      export type ClrProgressBarInputs = {
        /**
         * Displays the danger flash.
         *
         * @deprecated since 2.0, remove in 4.0
         * @default false
         */
        clrFlashDanger?: boolean | string;
      }
      \`\`\`"
    `);
  });

  it('keeps a bare @deprecated as a doc comment of its own', () => {
    const result = buildApiDescription(
      argTypes({
        legacy: {
          name: 'legacy',
          type: { name: 'boolean', required: true },
          table: {
            category: 'inputs',
            jsDocTags: { deprecated: '' },
            type: { summary: 'boolean' },
          },
        },
      }),
      'ButtonComponent'
    );

    expect(result).toMatchInlineSnapshot(`
      "## Inputs

      \`\`\`
      export type ButtonComponentInputs = {
        /** @deprecated */
        legacy: boolean;
      }
      \`\`\`"
    `);
  });

  it('escapes a comment terminator in the description and the deprecation text', () => {
    const result = buildApiDescription(
      argTypes({
        pattern: {
          name: 'pattern',
          description: 'Matches */ everything.',
          type: { name: 'string', required: true },
          table: {
            category: 'inputs',
            jsDocTags: { deprecated: 'use */ instead' },
            type: { summary: 'string' },
          },
        },
      }),
      'GlobComponent'
    );

    expect(result).toContain('   * Matches *\\/ everything.');
    expect(result).toContain('   * @deprecated use *\\/ instead');
    expect(result).toContain('  pattern: string;');
    expect(result?.match(/\*\//g)).toHaveLength(1);
  });

  // No sbType at all is a shape the analyzer never emits, so this is about the defensive read:
  // an unrecorded flag reports the input as optional rather than claiming it must be bound.
  it('falls back to `any` and to optional when the analyzer reported no type', () => {
    const result = buildApiDescription(
      argTypes({
        label: { name: 'label', table: { category: 'inputs' } },
      }),
      'ButtonComponent'
    );

    expect(result).toContain('label?: any;');
  });

  it('quotes apostrophes, backslashes, and newlines as valid JSON strings', () => {
    const result = buildApiDescription(
      argTypes({
        "it's": {
          name: "it's",
          table: { category: 'inputs', type: { summary: 'string' } },
        },
        'back\\slash': {
          name: 'back\\slash',
          table: { category: 'inputs', type: { summary: 'string' } },
        },
        'line\nbreak': {
          name: 'line\nbreak',
          table: { category: 'inputs', type: { summary: 'string' } },
        },
      }),
      'OddNamesComponent'
    );

    expect(result).toContain(`"it's"?: string;`);
    expect(result).toContain(`"back\\\\slash"?: string;`);
    expect(result).toContain(`"line\\nbreak"?: string;`);
  });

  it('keeps a hyphenated two-way binding name unquoted in its annotation', () => {
    const name = 'aria-label';
    const result = buildApiDescription(
      argTypes({
        [name]: {
          name,
          table: { category: 'inputs', type: { summary: 'string' } },
        },
        [`${name}Change`]: {
          name: `${name}Change`,
          table: { category: 'outputs', type: { summary: 'EventEmitter<string>' } },
        },
      }),
      'OddNamesComponent'
    );

    expect(result).toContain(`"aria-label"?: string; // two-way: [(aria-label)]`);
  });

  it('escapes a malicious two-way binding name without breaking the code fence', () => {
    const name = 'mode\\path\n```\nspoof\u2028tail';
    const result = buildApiDescription(
      argTypes({
        [name]: {
          name,
          table: { category: 'inputs', type: { summary: 'string' } },
        },
        [`${name}Change`]: {
          name: `${name}Change`,
          table: { category: 'outputs', type: { summary: 'EventEmitter<string>' } },
        },
      }),
      'OddNamesComponent'
    );

    expect(result).toContain(
      `"mode\\\\path\\n\`\`\`\\nspoof\\u2028tail"?: string; // two-way: [(mode\\\\path\\n\`\`\`\\nspoof\\u2028tail)]`
    );
    expect(result).not.toContain(name);
  });

  it('quotes a field name that is not a valid TypeScript identifier', () => {
    const result = buildApiDescription(
      argTypes({
        'aria-label': {
          name: 'aria-label',
          table: { category: 'inputs', type: { summary: 'string' } },
        },
        'sr-title': {
          name: 'sr-title',
          type: { name: 'string', required: true },
          table: { category: 'inputs', type: { summary: 'string' } },
        },
        'row-select': {
          name: 'row-select',
          table: {
            category: 'outputs',
            type: { summary: 'EventEmitter<Event>' },
          },
        },
      }),
      'DataColumnComponent'
    );

    expect(result).toContain(`"aria-label"?: string;`);
    expect(result).toContain(`"sr-title": string;`);
    expect(result).toContain(`"row-select": EventEmitter<Event>;`);
  });
});
