import { print } from 'esrap';
import { describe, it } from 'vitest';

import { createNamedExportStories } from './create-named-export-stories.js';

describe(createNamedExportStories, () => {
  it('works', ({ expect }) => {
    const namedExportDeclaration = createNamedExportStories({
      storiesIdentifiers: [
        {
          exportName: 'Default',
          name: undefined,
        },
        {
          exportName: 'Primary',
          name: 'Primary',
        },
        {
          exportName: 'Secondary',
          name: 'Secondary',
        },
        {
          exportName: 'Disabled',
          name: 'Disabled',
        },
      ],
    });

    expect(print(namedExportDeclaration).code).toMatchInlineSnapshot(`
      "export {
      	$__Default as Default,
      	$__Primary as Primary,
      	$__Secondary as Secondary,
      	$__Disabled as Disabled
      };"
    `);
  });
});
