import { describe, expect, it } from 'vitest';

import { mapArgTypes } from './map-arg-types.ts';

describe('mapArgTypes', () => {
  it('maps an attribute', () => {
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

  it('maps an event pair', () => {
    const argTypes = mapArgTypes({
      events: [{ name: 'my-change', description: 'Changed.', type: { text: 'CustomEvent' } }],
    });

    expect(argTypes).toMatchInlineSnapshot(`
      {
        "my-change": {
          "description": "Changed.",
          "name": "my-change",
          "required": false,
          "table": {
            "category": "events",
            "defaultValue": {
              "summary": undefined,
            },
            "type": {
              "summary": "CustomEvent",
            },
          },
          "type": {
            "name": "void",
          },
        },
        "onMyChange": {
          "action": {
            "name": "my-change",
          },
          "name": "onMyChange",
          "table": {
            "disable": true,
          },
        },
      }
    `);
  });

  it('maps a slot', () => {
    const argTypes = mapArgTypes({
      slots: [{ name: 'footer', description: 'Footer slot.' }],
    });

    expect(argTypes).toMatchInlineSnapshot(`
      {
        "footer": {
          "description": "Footer slot.",
          "name": "footer",
          "required": false,
          "table": {
            "category": "slots",
            "defaultValue": {
              "summary": undefined,
            },
            "type": {
              "summary": undefined,
            },
          },
          "type": {
            "name": "string",
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

  it('preserves type objects without text', () => {
    const argTypes = mapArgTypes({
      attributes: [{ name: 'x', type: { kind: 'union' } as unknown as { text?: string } }],
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
              "summary": {
                "kind": "union",
              },
            },
          },
          "type": {
            "name": {
              "kind": "union",
            },
          },
        },
      }
    `);
  });

  it('falls back to the type object for empty text', () => {
    const argTypes = mapArgTypes({
      attributes: [{ name: 'x', type: { text: '' } }],
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
              "summary": {
                "text": "",
              },
            },
          },
          "type": {
            "name": {
              "text": "",
            },
          },
        },
      }
    `);
  });
});
