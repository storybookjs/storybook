import { beforeEach, expect, test, vi } from 'vitest';

import { loadCsf } from 'storybook/internal/csf-tools';

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { getImports as buildImports, getComponentImports } from './getComponentImports';
import { fsMocks } from './test-utils';

vi.mock('node:fs/promises', async () => (await import('memfs')).fs.promises);
vi.mock('node:fs', async () => (await import('memfs')).fs);
vi.mock('tsconfig-paths', () => ({ loadConfig: () => ({ resultType: null!, message: null! }) }));

// Mock resolveImport to deterministically resolve known relative imports for these tests
vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveImport: (id: string) => {
    return {
      './Button': './src/stories/Button.tsx',
      './Header': './src/stories/Header.tsx',
    }[id];
  },
}));

beforeEach(() => {
  vi.spyOn(process, 'cwd').mockReturnValue('/app');
  vol.fromJSON(fsMocks, '/app');
  return () => vol.reset();
});

const getImports = (code: string, packageName?: string, storyFilePath?: string) =>
  getComponentImports({
    csf: loadCsf(code, { makeTitle: (t?: string) => t ?? 'title' }).parse(),
    packageName,
    storyFilePath,
  });

test('Get imports from multiple components', async () => {
  const code = dedent`
    import type { Meta } from '@storybook/react';
    import { ButtonGroup } from '@design-system/button-group';
    import { Button } from '@design-system/button';

    const meta: Meta<typeof Button> = {
      component: Button,
      args: {
        children: 'Click me'
      }
    };
    export default meta;
    export const Default: Story = <ButtonGroup><Button>Click me</Button></ButtonGroup>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@design-system/button",
          "importName": "Button",
          "localImportName": "Button",
          "path": undefined,
        },
        {
          "componentName": "ButtonGroup",
          "importId": "@design-system/button-group",
          "importName": "ButtonGroup",
          "localImportName": "ButtonGroup",
          "path": undefined,
        },
      ],
      "imports": [
        "import { Button } from "@design-system/button";",
        "import { ButtonGroup } from "@design-system/button-group";",
      ],
    }
  `
  );
});

test('Namespace import with member usage', async () => {
  const code = dedent`
    import * as Accordion from '@ds/accordion';

    const meta = {};
    export default meta;
    export const S = <Accordion.Root>Hi</Accordion.Root>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Accordion.Root",
          "importId": "@ds/accordion",
          "importName": "Root",
          "localImportName": "Accordion",
          "namespace": "Accordion",
          "path": undefined,
        },
      ],
      "imports": [
        "import * as Accordion from "@ds/accordion";",
      ],
    }
  `
  );
});

test('Named import used as namespace object', async () => {
  const code = dedent`
    import { Accordion } from '@ds/accordion';

    const meta = {};
    export default meta;
    export const S = <Accordion.Root>Hi</Accordion.Root>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Accordion.Root",
          "importId": "@ds/accordion",
          "importName": "Accordion",
          "localImportName": "Accordion",
          "path": undefined,
        },
      ],
      "imports": [
        "import { Accordion } from "@ds/accordion";",
      ],
    }
  `
  );
});

test('Default import', async () => {
  const code = dedent`
    import Button from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "default",
          "localImportName": "Button",
          "path": undefined,
        },
      ],
      "imports": [
        "import Button from "@ds/button";",
      ],
    }
  `
  );
});

test('Alias named import and meta.component inclusion', async () => {
  const code = dedent`
    import DefaultComponent, { Button as Btn, Other } from '@ds/button';

    const meta = { component: Btn };
    export default meta;
    export const S = <Other><Btn/></Other>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Btn",
          "importId": "@ds/button",
          "importName": "Button",
          "localImportName": "Btn",
          "path": undefined,
        },
        {
          "componentName": "Other",
          "importId": "@ds/button",
          "importName": "Other",
          "localImportName": "Other",
          "path": undefined,
        },
      ],
      "imports": [
        "import { Button as Btn, Other } from "@ds/button";",
      ],
    }
  `
  );
});

test('Strip unused specifiers from the same import statement', async () => {
  const code = dedent`
    import { Button as Btn, useSomeHook } from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Btn/>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Btn",
          "importId": "@ds/button",
          "importName": "Button",
          "localImportName": "Btn",
          "path": undefined,
        },
      ],
      "imports": [
        "import { Button as Btn } from "@ds/button";",
      ],
    }
  `
  );
});

test('Meta component with member and star import', async () => {
  const code = dedent`
    import * as Accordion from '@ds/accordion';

    const meta = { component: Accordion.Root };
    export default meta;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Accordion.Root",
          "importId": "@ds/accordion",
          "importName": "Root",
          "localImportName": "Accordion",
          "namespace": "Accordion",
          "path": undefined,
        },
      ],
      "imports": [
        "import * as Accordion from "@ds/accordion";",
      ],
    }
  `
  );
});

test('Keeps multiple named specifiers and drops unused ones from same import', async () => {
  const code = dedent`
    import { Button, ButtonGroup, useHook } from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <div><Button/><ButtonGroup/></div>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "Button",
          "localImportName": "Button",
          "path": undefined,
        },
        {
          "componentName": "ButtonGroup",
          "importId": "@ds/button",
          "importName": "ButtonGroup",
          "localImportName": "ButtonGroup",
          "path": undefined,
        },
      ],
      "imports": [
        "import { Button, ButtonGroup } from "@ds/button";",
      ],
    }
  `
  );
});

test('Mixed default + named import: keep only default when only default used', async () => {
  const code = dedent`
    import Button, { useHook } from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "default",
          "localImportName": "Button",
          "path": undefined,
        },
      ],
      "imports": [
        "import Button from "@ds/button";",
      ],
    }
  `
  );
});

test('Mixed default + named import: keep only named when only named (alias) used', async () => {
  const code = dedent`
    import Button, { Button as Btn } from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Btn/>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Btn",
          "importId": "@ds/button",
          "importName": "Button",
          "localImportName": "Btn",
          "path": undefined,
        },
      ],
      "imports": [
        "import { Button as Btn } from "@ds/button";",
      ],
    }
  `
  );
});

test('Per-specifier type import is dropped when mixing with value specifiers', async () => {
  const code = dedent`
    import type { Meta } from '@storybook/react';
    import { type Meta as M, Button } from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "Button",
          "localImportName": "Button",
          "path": undefined,
        },
      ],
      "imports": [
        "import { Button } from "@ds/button";",
      ],
    }
  `
  );
});

test('Namespace import used for multiple members kept once', async () => {
  const code = dedent`
    import * as DS from '@ds/ds';

    const meta = {};
    export default meta;
    export const S = <div><DS.A/><DS.B/></div>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "DS.A",
          "importId": "@ds/ds",
          "importName": "A",
          "localImportName": "DS",
          "namespace": "DS",
          "path": undefined,
        },
        {
          "componentName": "DS.B",
          "importId": "@ds/ds",
          "importName": "B",
          "localImportName": "DS",
          "namespace": "DS",
          "path": undefined,
        },
      ],
      "imports": [
        "import * as DS from "@ds/ds";",
      ],
    }
  `
  );
});

test('Default import kept when referenced only via meta.component', async () => {
  const code = dedent`
    import Button from '@ds/button';

    const meta = { component: Button };
    export default meta;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "default",
          "localImportName": "Button",
          "path": undefined,
        },
      ],
      "imports": [
        "import Button from "@ds/button";",
      ],
    }
  `
  );
});

test('Side-effect-only import is ignored', async () => {
  const code = dedent`
    import '@ds/global.css';
    import { Button } from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "Button",
          "localImportName": "Button",
          "path": undefined,
        },
      ],
      "imports": [
        "import { Button } from "@ds/button";",
      ],
    }
  `
  );
});

// New tests for packageName behavior

test('Converts default relative import to named when packageName provided', async () => {
  const code = dedent`
    import Header from './Header';

    const meta = {};
    export default meta;
    export const S = <Header/>;
  `;
  expect(
    await getImports(code, 'my-package', '/app/src/stories/Header.stories.tsx')
  ).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Header",
          "importId": "./Header",
          "importName": "default",
          "importOverride": "import { Header } from '@design-system/components/Header';",
          "localImportName": "Header",
          "path": "./src/stories/Header.tsx",
          "reactDocgen": {
            "data": {
              "actualName": "",
              "definedInFile": "./src/stories/Header.tsx",
              "description": "@import import { Header } from '@design-system/components/Header';",
              "exportName": "default",
              "methods": [],
              "props": {
                "onCreateAccount": {
                  "description": "",
                  "required": false,
                  "tsType": {
                    "name": "signature",
                    "raw": "() => void",
                    "signature": {
                      "arguments": [],
                      "return": {
                        "name": "void",
                      },
                    },
                    "type": "function",
                  },
                },
                "onLogin": {
                  "description": "",
                  "required": false,
                  "tsType": {
                    "name": "signature",
                    "raw": "() => void",
                    "signature": {
                      "arguments": [],
                      "return": {
                        "name": "void",
                      },
                    },
                    "type": "function",
                  },
                },
                "onLogout": {
                  "description": "",
                  "required": false,
                  "tsType": {
                    "name": "signature",
                    "raw": "() => void",
                    "signature": {
                      "arguments": [],
                      "return": {
                        "name": "void",
                      },
                    },
                    "type": "function",
                  },
                },
                "user": {
                  "description": "",
                  "required": false,
                  "tsType": {
                    "name": "User",
                  },
                },
              },
            },
            "type": "success",
          },
        },
      ],
      "imports": [
        "import { Header } from "@design-system/components/Header";",
      ],
    }
  `
  );
});

test('Converts relative import to provided packageName', async () => {
  const code = dedent`
    import { Button } from './Button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(
    await getImports(code, 'my-package', '/app/src/stories/Button.stories.tsx')
  ).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "./Button",
          "importName": "Button",
          "importOverride": "import { Button } from '@design-system/components/Button';",
          "localImportName": "Button",
          "path": "./src/stories/Button.tsx",
          "reactDocgen": {
            "data": {
              "actualName": "Button",
              "definedInFile": "./src/stories/Button.tsx",
              "description": "Primary UI component for user interaction
    @import import { Button } from '@design-system/components/Button';",
              "displayName": "Button",
              "exportName": "Button",
              "methods": [],
              "props": {
                "backgroundColor": {
                  "description": "",
                  "required": false,
                  "tsType": {
                    "name": "string",
                  },
                },
                "label": {
                  "description": "",
                  "required": true,
                  "tsType": {
                    "name": "string",
                  },
                },
                "onClick": {
                  "description": "",
                  "required": false,
                  "tsType": {
                    "name": "signature",
                    "raw": "() => void",
                    "signature": {
                      "arguments": [],
                      "return": {
                        "name": "void",
                      },
                    },
                    "type": "function",
                  },
                },
                "primary": {
                  "defaultValue": {
                    "computed": false,
                    "value": "false",
                  },
                  "description": "Description of primary",
                  "required": false,
                  "tsType": {
                    "name": "boolean",
                  },
                },
                "size": {
                  "defaultValue": {
                    "computed": false,
                    "value": "'medium'",
                  },
                  "description": "",
                  "required": false,
                  "tsType": {
                    "elements": [
                      {
                        "name": "literal",
                        "value": "'small'",
                      },
                      {
                        "name": "literal",
                        "value": "'medium'",
                      },
                      {
                        "name": "literal",
                        "value": "'large'",
                      },
                    ],
                    "name": "union",
                    "raw": "'small' | 'medium' | 'large'",
                  },
                },
              },
            },
            "type": "success",
          },
        },
      ],
      "imports": [
        "import { Button } from "@design-system/components/Button";",
      ],
    }
  `
  );
});

test('Keeps relative import when packageName is missing', async () => {
  const code = dedent`
    import { Button } from './components/Button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "./components/Button",
          "importName": "Button",
          "localImportName": "Button",
          "path": undefined,
        },
      ],
      "imports": [
        "import { Button } from "./components/Button";",
      ],
    }
  `
  );
});

test('Non-relative import remains unchanged even if packageName provided', async () => {
  const code = dedent`
    import { Button } from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(await getImports(code, 'my-package')).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "Button",
          "localImportName": "Button",
          "path": undefined,
        },
      ],
      "imports": [
        "import { Button } from \"@ds/button\";",
      ],
    }
  `
  );
});

// Merging imports from same package

test('Merges multiple imports from the same package (defaults and named)', async () => {
  const code = dedent`
    import { CopilotIcon } from '@primer/octicons-react';
    import { Banner } from "@primer/react";
    import Link from "@primer/react";
    import { Dialog } from "@primer/react";
    import { Stack } from "@primer/react";
    import Heading from "@primer/react";

    const meta = {};
    export default meta;
    export const S = <div><Link/><Heading/><Banner/><Dialog/><Stack/><CopilotIcon/></div>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Banner",
          "importId": "@primer/react",
          "importName": "Banner",
          "localImportName": "Banner",
          "path": undefined,
        },
        {
          "componentName": "CopilotIcon",
          "importId": "@primer/octicons-react",
          "importName": "CopilotIcon",
          "localImportName": "CopilotIcon",
          "path": undefined,
        },
        {
          "componentName": "Dialog",
          "importId": "@primer/react",
          "importName": "Dialog",
          "localImportName": "Dialog",
          "path": undefined,
        },
        {
          "componentName": "Heading",
          "importId": "@primer/react",
          "importName": "default",
          "localImportName": "Heading",
          "path": undefined,
        },
        {
          "componentName": "Link",
          "importId": "@primer/react",
          "importName": "default",
          "localImportName": "Link",
          "path": undefined,
        },
        {
          "componentName": "Stack",
          "importId": "@primer/react",
          "importName": "Stack",
          "localImportName": "Stack",
          "path": undefined,
        },
      ],
      "imports": [
        "import Heading, { Banner, Dialog, Stack } from "@primer/react";",
        "import Link from "@primer/react";",
        "import { CopilotIcon } from "@primer/octicons-react";",
      ],
    }
  `
  );
});

test('Merges namespace with default and separates named for same package', async () => {
  const code = dedent`
    import * as PR from '@primer/react';
    import { Banner } from '@primer/react';
    import Link from '.';

    const meta = {};
    export default meta;
    export const S = <div><Link/><PR.Box/><Banner/></div>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Banner",
          "importId": "@primer/react",
          "importName": "Banner",
          "localImportName": "Banner",
          "path": undefined,
        },
        {
          "componentName": "Link",
          "importId": ".",
          "importName": "default",
          "localImportName": "Link",
          "path": undefined,
        },
        {
          "componentName": "PR.Box",
          "importId": "@primer/react",
          "importName": "Box",
          "localImportName": "PR",
          "namespace": "PR",
          "path": undefined,
        },
      ],
      "imports": [
        "import * as PR from "@primer/react";",
        "import { Banner } from "@primer/react";",
        "import Link from ".";",
      ],
    }
  `
  );
});

test('Object.assign aliasing of imported component retains correct import', async () => {
  const code = dedent`
    import type { Meta } from '@storybook/react';
    import {ActionList as _ActionList} from '../../deprecated/ActionList'
    import {Header} from '../../deprecated/ActionList/Header'
    const ActionList = Object.assign(_ActionList, {
      Header,
    })

    const meta: Meta = {
      component: ActionList,
    }
    export default meta;

    const Story = () => <ActionList/>
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [],
      "imports": [],
    }
  `
  );
});

test('Component not imported returns undefined importId and importName', async () => {
  const code = dedent`
    const meta = {};
    export default meta;
    export const S = <Missing/>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Missing",
          "path": undefined,
        },
      ],
      "imports": [],
    }
  `
  );
});

test('Namespace component not imported returns undefined importId and importName', async () => {
  const code = dedent`
    const meta = {};
    export default meta;
    export const S = <PR.Box/>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "PR.Box",
          "path": undefined,
        },
      ],
      "imports": [],
    }
  `
  );
});

test('Filters out locally defined components', async () => {
  const code = dedent`
    const Local = () => <div/>;

    const meta = { component: Local };
    export default meta;
    export const S = <Local/>;
  `;
  expect(await getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [],
      "imports": [],
    }
    `
  );
});

test('importOverride: default override forces default import (keeps local name)', async () => {
  const code = dedent`
    import { Button } from './Button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  const csf = loadCsf(code, { makeTitle: (t) => t ?? 'No title' }).parse();
  const base = await getComponentImports({
    csf,
    packageName: 'my-package',
    storyFilePath: '/app/src/stories/Button.stories.tsx',
  });
  const patched = base.components.map((c) =>
    c.componentName === 'Button' ? { ...c, importOverride: "import Button from '@pkg/button';" } : c
  );
  const out = buildImports({ components: patched, packageName: 'my-package' });
  expect(out).toMatchInlineSnapshot(`
    [
      "import Button from \"@pkg/button\";",
    ]
  `);
});

test('importOverride: named override aliases imported to local name', async () => {
  const code = dedent`
    import Button from './Button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  const csf = loadCsf(code, { makeTitle: (t) => t ?? 'No title' }).parse();
  const base = await getComponentImports({
    csf,
    packageName: 'pkg',
    storyFilePath: '/app/src/stories/Button.stories.tsx',
  });
  const patched = base.components.map((c) =>
    c.componentName === 'Button'
      ? { ...c, importOverride: "import { DSButton } from '@pkg/button';" }
      : c
  );
  const out = buildImports({ components: patched, packageName: 'pkg' });
  expect(out).toMatchInlineSnapshot(`
    [
      "import { DSButton as Button } from \"@pkg/button\";",
    ]
  `);
});

test('importOverride: ignores namespace override and falls back', async () => {
  const code = dedent`
    import * as UI from './ui';

    const meta = {};
    export default meta;
    export const S = <UI.Button/>;
  `;
  const csf = loadCsf(code, { makeTitle: (t) => t ?? 'No title' }).parse();
  const discovered = await getComponentImports({
    csf,
    packageName: 'pkg',
    storyFilePath: '/app/src/stories/ui.stories.tsx',
  });
  const patched = discovered.components.map((c) =>
    c.componentName === 'UI.Button' ? { ...c, importOverride: "import * as UI from '@pkg/ui';" } : c
  );
  const out = buildImports({ components: patched, packageName: 'pkg' });
  expect(out).toMatchInlineSnapshot(`
    [
      "import { Button } from \"pkg\";",
    ]
  `);
});

test('importOverride: malformed string is ignored and behavior falls back', async () => {
  const code = dedent`
    import { Header } from './Header';

    const meta = {};
    export default meta;
    export const S = <Header/>;
  `;
  const csf = loadCsf(code, { makeTitle: (t) => t ?? 'No title' }).parse();
  const base = await getComponentImports({
    csf,
    packageName: 'pkg',
    storyFilePath: '/app/src/stories/Header.stories.tsx',
  });
  const patched = base.components.map((c) =>
    c.componentName === 'Header' ? { ...c, importOverride: 'import oops not valid' } : c
  );
  const out = buildImports({ components: patched, packageName: 'pkg' });
  expect(out).toMatchInlineSnapshot(`
    [
      "import { Header } from \"pkg\";",
    ]
  `);
});

test('importOverride: merges multiple components into a single declaration per source', async () => {
  const code = dedent`
    import Button from './Button';
    import { Header } from './Header';

    const meta = {};
    export default meta;
    export const A = <Button/>;
    export const B = <Header/>;
  `;
  const csf = loadCsf(code, { makeTitle: (t) => t ?? 'No title' }).parse();
  const base = await getComponentImports({
    csf,
    packageName: 'pkg',
    storyFilePath: '/app/src/stories/multi.stories.tsx',
  });
  const patched = base.components.map((c) =>
    c.componentName === 'Button'
      ? { ...c, importOverride: "import { DSButton } from '@ds/ui';" }
      : c.componentName === 'Header'
        ? { ...c, importOverride: "import { Header } from '@ds/ui';" }
        : c
  );
  const out = buildImports({ components: patched, packageName: 'pkg' });
  expect(out).toMatchInlineSnapshot(`
    [
      "import { DSButton as Button, Header } from \"@ds/ui\";",
    ]
  `);
});
