import { describe, expect, it } from 'vitest';

import type { ManifestDeclaration, ManifestEvent } from './manifest/types.ts';
import { buildApiDescription } from './api-description.ts';

const TYPE_PROPERTY = 'parsedType';

const declaration = (value: Partial<ManifestDeclaration>): ManifestDeclaration => ({
  customElement: true,
  kind: 'class',
  name: 'XCard',
  tagName: 'x-card',
  ...value,
});

describe('buildApiDescription', () => {
  it('builds every section in manifest order', () => {
    expect(
      buildApiDescription(
        declaration({
          name: 'ToolkitShape',
          tagName: 'toolkit-shape',
          attributes: [
            { name: 'size', fieldName: 'size' },
            { name: 'old-size', fieldName: 'oldSize' },
            { name: 'open', fieldName: 'open' },
          ],
          members: [
            {
              kind: 'field',
              name: 'size',
              type: { text: 'Size' },
              parsedType: { text: "'small' | 'medium' | 'large'" },
              default: "'medium'",
              description: 'The current size.',
            },
            {
              kind: 'field',
              name: 'oldSize',
              type: { text: 'string' },
              default: "''",
              description: 'The legacy size.',
              deprecated: 'Use `size` instead.',
            },
            {
              kind: 'field',
              name: 'open',
              type: { text: 'boolean' },
              default: 'false',
            },
            {
              kind: 'field',
              name: 'version',
              readonly: true,
              type: { text: 'string' },
              default: "'1.0.0'",
              description: 'The current version.',
            },
            {
              kind: 'field',
              name: 'pressed',
              type: { text: 'boolean' },
              default: 'false',
              description: 'Whether the control is pressed.',
            },
            {
              kind: 'method',
              name: 'focusItem',
              description: 'Focuses an item.',
              parameters: [
                { name: 'index', type: { text: 'number' } },
                { name: 'options', optional: true, type: { text: '{ smooth: boolean }' } },
              ],
              return: { type: { text: 'boolean' } },
            },
          ] as ManifestDeclaration['members'],
          events: [
            {
              name: 'toolkit-resize',
              type: { text: 'CustomEvent<Size>' },
              parsedType: { text: "CustomEvent<{ size: 'small' | 'medium' | 'large' }>" },
              description: 'Fired when the size changes.',
            } as ManifestEvent & { parsedType: { text: string } },
            { name: 'click', description: 'Fired on click.' } as ManifestEvent,
          ],
          slots: [{ name: '' }, { name: 'label' }],
          cssProperties: [
            { name: '--toolkit-color', type: { text: '<color>' } },
            { name: '--toolkit-gap', default: '4px' },
          ] as ManifestDeclaration['cssProperties'],
          cssParts: [{ name: 'base' }],
          cssStates: [{ name: 'active' }],
        }),
        TYPE_PROPERTY
      )
    ).toMatchInlineSnapshot(`
      "## Attributes

      \`\`\`
      export type ToolkitShapeAttributes = {
        /** The current size. */
        size?: 'small' | 'medium' | 'large' = 'medium';
        /**
         * The legacy size.
         *
         * @deprecated Use \`size\` instead.
         */
        'old-size'?: string = ''; // property: oldSize
        open?: boolean = false;
      }
      \`\`\`

      ## Properties

      \`\`\`
      export type ToolkitShapeProperties = {
        /** The current version. */
        readonly version: string = '1.0.0';
        /** Whether the control is pressed. */
        pressed?: boolean = false;
      }
      \`\`\`

      ## Events

      \`\`\`
      export type ToolkitShapeEvents = {
        /** Fired when the size changes. */
        'toolkit-resize': CustomEvent<{ size: 'small' | 'medium' | 'large' }>;
        /** Fired on click. */
        click: Event;
      }
      \`\`\`

      ## Methods

      \`\`\`
      export type ToolkitShapeMethods = {
        /** Focuses an item. */
        focusItem(index: number, options?: { smooth: boolean }): boolean;
      }
      \`\`\`

      ## Slots

      - default
      - label

      ## CSS Custom Properties

      - --toolkit-color \`<color>\`
      - --toolkit-gap Default: 4px.

      ## CSS Parts

      - base

      ## CSS States

      - active"
    `);
  });

  it('collapses line breaks in defaults and keeps inline spaces', () => {
    expect(
      buildApiDescription(
        declaration({
          name: 'XOptions',
          members: [
            {
              kind: 'field',
              name: 'options',
              type: { text: 'Options' },
              default: '{\n  a: 1,\n}',
            },
            {
              kind: 'field',
              name: 'label',
              type: { text: 'string' },
              default: "'A  B'",
            },
          ],
        }),
        TYPE_PROPERTY
      )
    ).toMatchInlineSnapshot(`
      "## Properties

      \`\`\`
      export type XOptionsProperties = {
        options?: Options = { a: 1, };
        label?: string = 'A  B';
      }
      \`\`\`"
    `);
  });

  it('renders an attribute-only element', () => {
    expect(
      buildApiDescription(
        declaration({
          name: 'XToggle',
          attributes: [
            { name: 'disabled', type: { text: 'boolean' } },
            { name: 'label', type: { text: 'string' } },
          ],
        }),
        TYPE_PROPERTY
      )
    ).toMatchInlineSnapshot(`
      "## Attributes

      \`\`\`
      export type XToggleAttributes = {
        disabled?: boolean;
        label?: string;
      }
      \`\`\`"
    `);
  });

  it('drops attributes backed by hidden fields and excludes static and private members', () => {
    expect(
      buildApiDescription(
        declaration({
          name: 'XHidden',
          attributes: [
            { name: 'visible', type: { text: 'string' } },
            { name: 'secret', fieldName: '_secret', type: { text: 'string' } },
            { name: 'global', fieldName: 'global', type: { text: 'string' } },
          ],
          members: [
            { kind: 'field', name: '_secret', privacy: 'private', type: { text: 'string' } },
            { kind: 'field', name: 'global', static: true, type: { text: 'string' } },
            { kind: 'field', name: 'publicValue', type: { text: 'number' } },
            { kind: 'field', name: 'privateValue', privacy: 'private', type: { text: 'number' } },
            { kind: 'field', name: 'staticValue', static: true, type: { text: 'number' } },
            { kind: 'method', name: 'run', return: { type: { text: 'void' } } },
            {
              kind: 'method',
              name: 'hide',
              privacy: 'private',
              return: { type: { text: 'void' } },
            },
            { kind: 'method', name: 'all', static: true, return: { type: { text: 'void' } } },
          ],
        }),
        TYPE_PROPERTY
      )
    ).toMatchInlineSnapshot(`
      "## Attributes

      \`\`\`
      export type XHiddenAttributes = {
        visible?: string;
      }
      \`\`\`

      ## Properties

      \`\`\`
      export type XHiddenProperties = {
        publicValue?: number;
      }
      \`\`\`

      ## Methods

      \`\`\`
      export type XHiddenMethods = {
        run(): void;
      }
      \`\`\`"
    `);
  });

  it('returns undefined for an empty declaration', () => {
    expect(buildApiDescription(declaration({}), TYPE_PROPERTY)).toMatchInlineSnapshot(`undefined`);
  });
});
