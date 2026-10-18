import { describe, expect, it } from 'vitest';

import { SourceEditor } from '../../../csf-tools/estree/editor.ts';
import { valueToSource } from './valueToSource.ts';

describe('valueToSource', () => {
  it('prints a RegExp as a literal instead of walking it as an object', () => {
    expect(valueToSource({ pattern: /x/g }, new SourceEditor(''))).toBe('{\n  pattern: /x/g,\n}');
  });
});
