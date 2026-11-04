import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import type { ReactHolePlace } from '../snippet-values.ts';
import { printHole } from './print-hole.ts';

describe('printHole', () => {
  it('prints the args a control added as attributes, but those its place leaves out', () => {
    expect(
      printHole(
        {
          place: { kind: 'attrs', except: ['size', 'children'] },
          spread: true,
        },
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
    const places: ReactHolePlace[] = [
      { kind: 'attr', name: 'format' },
      { kind: 'text' },
      { kind: 'close', element: 'Button' },
      { kind: 'value' },
    ];
    for (const place of places) {
      expect(() => printHole({ place, arg: 'format' }, () => '')).toThrow(
        new UnprintableArgError('format')
      );
    }
    expect(() =>
      printHole({ place: { kind: 'attrs', except: [] }, spread: true }, { format: () => '' })
    ).toThrow(new UnprintableArgError('format'));
  });
});
