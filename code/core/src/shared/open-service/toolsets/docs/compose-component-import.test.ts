import { describe, expect, it } from 'vitest';

import { composeComponentImport } from './compose-component-import.ts';

const jsDocTags = { import: ["import { Alpha } from '@design-system/components'"] };

describe('composeComponentImport', () => {
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
      "import { Alpha } from '@design-system/components';\nimport { Beta } from './beta'",
    ],
  ])('treats comment contents as import trivia: %s', (imports, name, expected) => {
    expect(composeComponentImport(jsDocTags, { name, import: imports })).toBe(expected);
  });
});
