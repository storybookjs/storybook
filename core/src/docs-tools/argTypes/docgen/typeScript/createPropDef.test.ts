import { describe, expect, it } from 'vitest';

import type { DocgenInfo } from '../types';
import { createTsPropDef } from './createPropDef';

const PROP_NAME = 'propName';

function createDocgenInfo({ tsType, ...others }: Partial<DocgenInfo>): DocgenInfo {
  return {
    tsType,
    required: true,
    ...others,
  } as DocgenInfo;
}

describe('type', () => {
  it("should remove ' | undefined' from optional props type", () => {
    const docgenInfo = createDocgenInfo({
      tsType: { name: 'string | undefined' },
      required: false,
    });

    const { type } = createTsPropDef(PROP_NAME, docgenInfo);

    expect(type?.summary).toBe('string');
    expect(type?.detail).toBeUndefined();
  });
});
