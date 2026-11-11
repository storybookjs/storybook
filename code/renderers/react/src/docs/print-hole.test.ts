import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import type { ReactHolePlace } from '../snippet-values.ts';
import { printHole } from './print-hole.ts';

describe('printHole', () => {
  it('prints the args a control added as attributes, but those its place leaves out', () => {
    expect(
      printHole(
        { kind: 'attrs', spread: true, except: ['size', 'children'] },
        {
          label: 'Go',
          size: 'lg',
          children: 'Save',
          'data.x': 1,
        }
      )
    ).toBe(' label="Go" {...{ "data.x": 1 }}');
  });

  it('prints an attribute named after its arg, unless the hole names it', () => {
    expect(printHole({ kind: 'attr', arg: 'label' }, 'Go')).toBe('label="Go"');
    expect(printHole({ kind: 'attr', arg: 'title', name: 'label' }, 'Go')).toBe('label="Go"');
  });

  it('throws for a value the snippet cannot show', () => {
    const places: ReactHolePlace[] = [{ kind: 'attr' }, { kind: 'text' }, { kind: 'value' }];
    for (const place of places) {
      expect(() => printHole({ ...place, arg: 'format' }, () => '')).toThrow(
        new UnprintableArgError('format')
      );
    }
    expect(() =>
      printHole({ kind: 'attrs', spread: true, except: [] }, { format: () => '' })
    ).toThrow(new UnprintableArgError('format'));
  });
});
