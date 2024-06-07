import type { Program } from 'estree';
import { toJs } from 'estree-util-to-js';
import { describe, it } from 'vitest';

import { createExportDefaultMeta } from './create-export-default.js';

describe(createExportDefaultMeta.name, () => {
  it('creates a new export default correctly', ({ expect }) => {
    const stringified = toJs(
      createExportDefaultMeta({
        metaIdentifier: {
          type: 'Identifier',
          name: 'meta',
        },
      }) as unknown as Program
    ).value;

    expect(stringified).toMatchInlineSnapshot(`"export default meta;"`);
  });

  it("works when 'meta' identifier was destructured manually and renamed by user", ({ expect }) => {
    const stringified = toJs(
      createExportDefaultMeta({
        metaIdentifier: {
          type: 'Identifier',
          name: '__renamed_meta',
        },
      }) as unknown as Program
    ).value;

    expect(stringified).toMatchInlineSnapshot(`"export default __renamed_meta;"`);
  });
});
