import type { Program } from 'estree';
import { toJs } from 'estree-util-to-js';
import { describe, it } from 'vitest';

import { createExportOrderVariable } from './create-export-order.js';

describe(createExportOrderVariable.name, () => {
  it('correctly creates a variable with named exports order', ({ expect }) => {
    const stringified = toJs(
      createExportOrderVariable({
        storyIdentifiers: [
          { exportName: 'Default', name: 'Default' },
          { exportName: 'SomeComponent', name: 'Some Component' },
          { exportName: 'ThisNameIsWeird', name: 'This-Name-Is-Weird' },
        ],
      }) as unknown as Program
    ).value;

    expect(stringified).toMatchInlineSnapshot(
      `"export const __namedExportsOrder = ["Default", "SomeComponent", "ThisNameIsWeird"];"`
    );
  });
});
