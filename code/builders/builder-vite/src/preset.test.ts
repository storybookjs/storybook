import { isAbsolute } from 'pathe';
import { describe, expect, it } from 'vitest';

import { optimizeViteDeps } from './preset.ts';
import { previewRuntimePath } from './utils/preview-runtime-path.ts';

describe('optimizeViteDeps preset', () => {
  it('prebundles the preview runtime resolved from the builder context, not a bare specifier', () => {
    expect(optimizeViteDeps).toEqual([previewRuntimePath]);
    expect(isAbsolute(previewRuntimePath)).toBe(true);
    expect(previewRuntimePath.endsWith('dist/preview/runtime.js')).toBe(true);
  });
});
