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
          table: {
            category: 'inputs',
            type: { summary: 'string', required: false },
            defaultValue: { summary: "'Click me'" },
          },
        },
        disabled: {
          name: 'disabled',
          table: { category: 'inputs', type: { summary: 'boolean', required: true } },
        },
        clicked: {
          name: 'clicked',
          description: 'Fires on every click.',
          table: { category: 'outputs', type: { summary: 'EventEmitter<Event>', required: false } },
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
            type: { summary: 'string', required: false },
            defaultValue: { summary: "'#345F92'" },
          },
        },
        colorChange: {
          name: 'colorChange',
          table: { category: 'outputs', type: { summary: '(e: string) => void', required: false } },
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
          table: { category: 'inputs', type: { summary: 'string', required: true } },
        },
        colorChange: {
          name: 'colorChange',
          table: { category: 'inputs', type: { summary: 'boolean', required: true } },
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
          table: { category: 'outputs', type: { summary: 'EventEmitter<void>', required: false } },
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
          table: { category: 'properties', type: { summary: 'ElementRef', required: true } },
        },
        focus: {
          name: 'focus',
          table: { category: 'methods', type: { summary: 'focus()', required: false } },
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
          table: { category: 'inputs', type: { summary: 'string', required: true } },
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
          table: { category: 'inputs', type: { summary: 'string', required: true } },
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
            type: { summary: 'number', required: false },
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

  it('falls back to `any` when the analyzer reported no type', () => {
    const result = buildApiDescription(
      argTypes({
        label: { name: 'label', table: { category: 'inputs' } },
      }),
      'ButtonComponent'
    );

    expect(result).toContain('label: any;');
  });
});
