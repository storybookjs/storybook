import { describe, expect, it } from 'vitest';

import { composeComponentImport } from './compose-component-import.ts';

const jsDocTags = { import: ["import { Alpha } from '@design-system/components'"] };

describe('composeComponentImport', () => {
  it('rewrites an escaped component binding', () => {
    expect(
      composeComponentImport(jsDocTags, {
        name: 'Alpha',
        import: String.raw`import { \u0041lpha } from './components'`,
      })
    ).toBe("import { Alpha } from '@design-system/components';");
  });

  it('preserves a named binding when the override is a namespace import', () => {
    expect(
      composeComponentImport(
        { import: ["import * as Components from '@design-system/components'"] },
        {
          name: 'Button',
          import: "import { Button } from './components'",
        }
      )
    ).toBe("import { Button } from './components'");
  });

  it('preserves a namespace binding when the override is a named import', () => {
    expect(
      composeComponentImport(jsDocTags, {
        name: 'UI.Alpha',
        import: "import * as UI from './components'",
      })
    ).toBe("import * as UI from './components'");
  });

  it.each([
    [
      "import /* legacy */ Alpha from './components'",
      'Alpha',
      "import { Alpha } from '@design-system/components';",
    ],
    [
      "import Alpha /* *, legacy */, * as Icons from './components'",
      'Alpha',
      "import { Alpha } from '@design-system/components';\nimport * as Icons from './components';",
    ],
    [
      "import { /* rationale, legacy */ Alpha } from './components'",
      'Alpha',
      "import { Alpha } from '@design-system/components';",
    ],
    [
      "import { Alpha /* rationale, legacy */, Icon } from './components'",
      'Alpha',
      "import { Alpha } from '@design-system/components';\nimport { Icon } from './components';",
    ],
    [
      "import {/* {, */ Alpha, Icon } from './components'",
      'Alpha',
      "import { Alpha } from '@design-system/components';\nimport { Icon } from './components';",
    ],
    [
      "import { Alpha/* binding */as Local } from './components'",
      'Local',
      "import { Alpha as Local } from '@design-system/components';",
    ],
    [
      "import { Alpha } from './alpha' /* see\nimport docs */\nimport { Beta } from './beta'",
      'Alpha',
      "import { Alpha } from '@design-system/components'; /* see\nimport docs */\nimport { Beta } from './beta'",
    ],
  ])('treats comment contents as import trivia: %s', (imports, name, expected) => {
    expect(composeComponentImport(jsDocTags, { name, import: imports })).toBe(expected);
  });
});
