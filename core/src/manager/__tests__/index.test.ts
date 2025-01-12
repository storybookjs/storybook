// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { renderStorybookUI } from '..';

describe('Main API', () => {
  it('should fail if provider is not extended from the base Provider', () => {
    const run = () => {
      const fakeProvider = {};
      // @ts-expect-error (Converted from ts-ignore)
      renderStorybookUI(null, fakeProvider);
    };

    expect(run).toThrow(/base Provider/);
  });
});
