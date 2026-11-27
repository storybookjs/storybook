import { describe, expect, it } from 'vitest';

import { mapArgTypes } from './map-arg-types.ts';

describe('mapArgTypes', () => {
  it('maps an attribute with a type object', () => {
    const argTypes = mapArgTypes({
      attributes: [{ name: 'label', description: 'Label.', type: { text: 'string' } }],
    });

    expect(argTypes).toMatchInlineSnapshot(`
      {
        "label": {
          "description": "Label.",
          "name": "label",
          "required": false,
          "table": {
            "category": "attributes",
            "defaultValue": {
              "summary": undefined,
            },
            "type": {
              "summary": "string",
            },
          },
          "type": {
            "name": "string",
          },
        },
      }
    `);
  });

  it('maps a plain string type', () => {
    const argTypes = mapArgTypes({
      attributes: [{ name: 'label', type: 'string' }],
    });

    expect(argTypes).toMatchInlineSnapshot(`
      {
        "label": {
          "description": undefined,
          "name": "label",
          "required": false,
          "table": {
            "category": "attributes",
            "defaultValue": {
              "summary": undefined,
            },
            "type": {
              "summary": "string",
            },
          },
          "type": {
            "name": "string",
          },
        },
      }
    `);
  });

  it('leaves the type undefined when the manifest has no type text', () => {
    const argTypes = mapArgTypes({
      attributes: [{ name: 'x', type: {} }],
    });

    expect(argTypes).toMatchInlineSnapshot(`
      {
        "x": {
          "description": undefined,
          "name": "x",
          "required": false,
          "table": {
            "category": "attributes",
            "defaultValue": {
              "summary": undefined,
            },
            "type": {
              "summary": undefined,
            },
          },
          "type": {
            "name": undefined,
          },
        },
      }
    `);
  });

  it('skips a method member', () => {
    const argTypes = mapArgTypes({
      members: [{ name: 'focus', kind: 'method' }],
    });

    expect(argTypes).toMatchInlineSnapshot(`
      {}
    `);
  });
});
