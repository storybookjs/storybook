import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { printHole } from './print-hole.ts';

describe('printHole', () => {
  it('prints the args a control added as attributes, but those its words name', () => {
    expect(
      printHole(
        { kind: 'attrs', words: ['size', 'children'] },
        {
          label: 'Go',
          size: 'lg',
          children: 'Save',
          'data.x': 1,
        }
      )
    ).toBe(' label="Go" {...{ "data.x": 1 }}');
  });

  it('throws for a value the snippet cannot show', () => {
    for (const kind of ['attr', 'text', 'close', 'value']) {
      expect(() => printHole({ kind, arg: 'format', words: ['format'] }, () => '')).toThrow(
        new UnprintableArgError('format')
      );
    }
    expect(() => printHole({ kind: 'attrs', words: [] }, { format: () => '' })).toThrow(
      new UnprintableArgError('format')
    );
  });
});
