import { describe, expect, it } from 'vitest';

import { MAX_SCHEMA_DEPTH, schemaLines, type JsonSchemaNode } from './schema-lines.ts';

const render = (schema: JsonSchemaNode, required = false) =>
  schemaLines('`--stories`', schema, required, '', MAX_SCHEMA_DEPTH);

describe('schemaLines', () => {
  it('renders type, requiredness and description on the head line', () => {
    expect(render({ type: 'string', description: 'A story id.' }, true)).toEqual([
      '- `--stories` (string, required): A story id.',
    ]);
  });

  it('omits the meta parentheses when the node has neither type nor requiredness', () => {
    expect(render({ description: 'Anything.' })).toEqual(['- `--stories`: Anything.']);
  });

  it('names the item type of an array', () => {
    expect(render({ type: 'array', items: { type: 'string' } })).toEqual([
      '- `--stories` (array of string)',
    ]);
    expect(render({ type: 'array' })).toEqual(['- `--stories` (array)']);
  });

  it('indents object properties under their parent and marks the required ones', () => {
    expect(
      render({
        type: 'object',
        properties: { storyId: { type: 'string' }, note: { type: 'string' } },
        required: ['storyId'],
      })
    ).toEqual([
      '- `--stories` (object)',
      '  - `storyId` (string, required)',
      '  - `note` (string)',
    ]);
  });

  it('describes the shape of array items once, not per item', () => {
    expect(
      render({
        type: 'array',
        items: {
          type: 'object',
          properties: { storyId: { type: 'string' } },
          required: ['storyId'],
        },
      })
    ).toEqual([
      '- `--stories` (array of object)',
      '  each item:',
      '    - `storyId` (string, required)',
    ]);
  });

  it('numbers union variants and carries their descriptions', () => {
    expect(
      render({
        anyOf: [
          { type: 'object', description: 'By id', properties: { storyId: { type: 'string' } } },
          { type: 'string' },
        ],
      })
    ).toEqual([
      '- `--stories` (one of)',
      '  option 1: By id',
      '    - `storyId` (string)',
      '  option 2',
    ]);
  });

  it('stops descending at the depth budget so a recursive schema cannot run away', () => {
    // Five nested objects; only MAX_SCHEMA_DEPTH levels may appear below the head line.
    let deepest: JsonSchemaNode = { type: 'string' };
    for (let level = 0; level < 5; level++) {
      deepest = { type: 'object', properties: { [`level${level}`]: deepest } };
    }

    const lines = render(deepest);

    expect(lines).toHaveLength(MAX_SCHEMA_DEPTH);
    expect(lines.at(-1)).toContain('level2');
  });
});
