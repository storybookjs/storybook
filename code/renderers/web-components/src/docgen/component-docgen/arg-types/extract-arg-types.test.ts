import { describe, expect, it } from 'vitest';

import { extractArgTypesFromDeclaration } from './extract-arg-types.ts';

describe('extractArgTypesFromDeclaration', () => {
  it.each([
    [
      'maps an attribute',
      { attributes: [{ name: 'label', description: 'Label.', type: { text: 'string' } }] },
    ],
    [
      'maps an event pair',
      { events: [{ name: 'my-change', description: 'Changed.', type: { text: 'CustomEvent' } }] },
    ],
    ['maps a slot', { slots: [{ name: 'footer', description: 'Footer slot.' }] }],
    ['skips a method member', { members: [{ name: 'focus', kind: 'method' }] }],
  ])('%s', (name, declaration) => {
    const argTypes = extractArgTypesFromDeclaration(declaration);

    if (name === 'maps an attribute') {
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
      return;
    }

    if (name === 'maps an event pair') {
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
      return;
    }

    if (name === 'maps a slot') {
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
      return;
    }

    expect(argTypes).toMatchInlineSnapshot(`
      {}
    `);
  });
});
