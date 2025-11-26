import { beforeEach, expect, test, vi } from 'vitest';

import { loadCsf } from 'storybook/internal/csf-tools';

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { fsMocks } from './fixtures';
import { getImports as buildImports, getComponentData } from './getComponentImports';

beforeEach(() => {
  vi.spyOn(process, 'cwd').mockReturnValue('/app');
  vol.fromJSON(fsMocks, '/app');
});

const getImports = (code: string, packageName?: string, storyFilePath?: string) => {
  storyFilePath ??= '/app/src/stories/Button.stories.tsx';
  const { components, imports } = getComponentData({
    csf: loadCsf(code, { makeTitle: (t?: string) => t ?? 'title' }).parse(),
    packageName,
    storyFilePath,
  });
  return { components: components.map(({ reactDocgen, ...rest }) => rest), imports };
};

test('Get imports from multiple components', () => {
  const code = dedent`
    import type { Meta } from '@storybook/react';
    import { ButtonGroup } from './button-group';
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
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@design-system/button",
          "importName": "Button",
          "importOverride": "import { Button } from '@design-system/components/override';",
          "isPackage": true,
          "localImportName": "Button",
          "path": "./src/stories/Button.tsx",
        },
        {
          "componentName": "ButtonGroup",
          "importId": "./button-group",
          "importName": "ButtonGroup",
          "isPackage": false,
          "localImportName": "ButtonGroup",
        },
      ],
      "imports": [
        "import { Button } from "@design-system/components/override";",
        "import { ButtonGroup } from "./button-group";",
      ],
    }
  `
  );
});

test('Namespace import with member usage', () => {
  const code = dedent`
    import * as Accordion from './accordion';

    const meta = {};
    export default meta;
    export const S = <Accordion.Root>Hi</Accordion.Root>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Accordion.Root",
          "importId": "./accordion",
          "importName": "Root",
          "isPackage": false,
          "localImportName": "Accordion",
          "namespace": "Accordion",
        },
      ],
      "imports": [
        "import * as Accordion from "./accordion";",
      ],
    }
  `
  );
});

test('Named import used as namespace object', () => {
  const code = dedent`
    import { Accordion } from './accordion';

    const meta = {};
    export default meta;
    export const S = <Accordion.Root>Hi</Accordion.Root>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Accordion.Root",
          "importId": "./accordion",
          "importName": "Accordion",
          "isPackage": false,
          "localImportName": "Accordion",
        },
      ],
      "imports": [
        "import { Accordion } from "./accordion";",
      ],
    }
  `
  );
});

test('Default import', () => {
  const code = dedent`
    import Button from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "default",
          "importOverride": "import { Button } from '@design-system/components/override';",
          "isPackage": true,
          "localImportName": "Button",
          "path": "./src/stories/Button.tsx",
        },
      ],
      "imports": [
        "import { Button } from "@design-system/components/override";",
      ],
    }
  `
  );
});

test('Alias named import and meta.component inclusion', () => {
  const code = dedent`
    import DefaultComponent, { Button as Btn } from '@ds/button';
    import { Other } from './other';

    const meta = { component: Btn };
    export default meta;
    export const S = <Other><Btn/></Other>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Btn",
          "importId": "@ds/button",
          "importName": "Button",
          "importOverride": "import { Button } from '@design-system/components/override';",
          "isPackage": true,
          "localImportName": "Btn",
          "path": "./src/stories/Button.tsx",
        },
        {
          "componentName": "Other",
          "importId": "./other",
          "importName": "Other",
          "isPackage": false,
          "localImportName": "Other",
        },
      ],
      "imports": [
        "import { Button as Btn } from "@design-system/components/override";",
        "import { Other } from "./other";",
      ],
    }
  `
  );
});

test('Strip unused specifiers from the same import statement', () => {
  const code = dedent`
    import { Button as Btn, useSomeHook } from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Btn/>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Btn",
          "importId": "@ds/button",
          "importName": "Button",
          "importOverride": "import { Button } from '@design-system/components/override';",
          "isPackage": true,
          "localImportName": "Btn",
          "path": "./src/stories/Button.tsx",
        },
      ],
      "imports": [
        "import { Button as Btn } from "@design-system/components/override";",
      ],
    }
  `
  );
});

test('Meta component with member and star import', () => {
  const code = dedent`
    import * as Accordion from './accordion';

    const meta = { component: Accordion.Root };
    export default meta;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Accordion.Root",
          "importId": "./accordion",
          "importName": "Root",
          "isPackage": false,
          "localImportName": "Accordion",
          "namespace": "Accordion",
        },
      ],
      "imports": [
        "import * as Accordion from "./accordion";",
      ],
    }
  `
  );
});

test('Keeps multiple named specifiers and drops unused ones from same import', () => {
  const code = dedent`
    import { Button, useHook } from '@ds/button';
    import { ButtonGroup } from './button-group';

    const meta = {};
    export default meta;
    export const S = <div><Button/><ButtonGroup/></div>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "Button",
          "importOverride": "import { Button } from '@design-system/components/override';",
          "isPackage": true,
          "localImportName": "Button",
          "path": "./src/stories/Button.tsx",
        },
        {
          "componentName": "ButtonGroup",
          "importId": "./button-group",
          "importName": "ButtonGroup",
          "isPackage": false,
          "localImportName": "ButtonGroup",
        },
      ],
      "imports": [
        "import { Button } from "@design-system/components/override";",
        "import { ButtonGroup } from "./button-group";",
      ],
    }
  `
  );
});

test('Mixed default + named import: keep only default when only default used', () => {
  const code = dedent`
    import Button, { useHook } from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "default",
          "importOverride": "import { Button } from '@design-system/components/override';",
          "isPackage": true,
          "localImportName": "Button",
          "path": "./src/stories/Button.tsx",
        },
      ],
      "imports": [
        "import { Button } from "@design-system/components/override";",
      ],
    }
  `
  );
});

test('Mixed default + named import: keep only named when only named (alias) used', () => {
  const code = dedent`
    import Button, { Button as Btn } from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Btn/>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Btn",
          "importId": "@ds/button",
          "importName": "Button",
          "importOverride": "import { Button } from '@design-system/components/override';",
          "isPackage": true,
          "localImportName": "Btn",
          "path": "./src/stories/Button.tsx",
        },
      ],
      "imports": [
        "import { Button as Btn } from "@design-system/components/override";",
      ],
    }
  `
  );
});

test('Per-specifier type import is dropped when mixing with value specifiers', () => {
  const code = dedent`
    import type { Meta } from '@storybook/react';
    import { type Meta as M, Button } from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "Button",
          "importOverride": "import { Button } from '@design-system/components/override';",
          "isPackage": true,
          "localImportName": "Button",
          "path": "./src/stories/Button.tsx",
        },
      ],
      "imports": [
        "import { Button } from "@design-system/components/override";",
      ],
    }
  `
  );
});

test('Namespace import used for multiple members kept once', () => {
  const code = dedent`
    import * as DS from './ds';

    const meta = {};
    export default meta;
    export const S = <div><DS.A/><DS.B/></div>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "DS.A",
          "importId": "./ds",
          "importName": "A",
          "isPackage": false,
          "localImportName": "DS",
          "namespace": "DS",
        },
        {
          "componentName": "DS.B",
          "importId": "./ds",
          "importName": "B",
          "isPackage": false,
          "localImportName": "DS",
          "namespace": "DS",
        },
      ],
      "imports": [
        "import * as DS from "./ds";",
      ],
    }
  `
  );
});

test('Default import kept when referenced only via meta.component', () => {
  const code = dedent`
    import Button from '@ds/button';

    const meta = { component: Button };
    export default meta;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "default",
          "importOverride": "import { Button } from '@design-system/components/override';",
          "isPackage": true,
          "localImportName": "Button",
          "path": "./src/stories/Button.tsx",
        },
      ],
      "imports": [
        "import { Button } from "@design-system/components/override";",
      ],
    }
  `
  );
});

test('Side-effect-only import is ignored', () => {
  const code = dedent`
    import '@ds/global.css';
    import { Button } from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "Button",
          "importOverride": "import { Button } from '@design-system/components/override';",
          "isPackage": true,
          "localImportName": "Button",
          "path": "./src/stories/Button.tsx",
        },
      ],
      "imports": [
        "import { Button } from "@design-system/components/override";",
      ],
    }
  `
  );
});

// New tests for packageName behavior

test('Converts default relative import to import override when provided', () => {
  const code = dedent`
    import Button from './Button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(
    getImports(code, 'my-package', '/app/src/stories/Button.stories.tsx')
  ).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "./Button",
          "importName": "default",
          "importOverride": "import { Button } from '@design-system/components/override';",
          "isPackage": false,
          "localImportName": "Button",
          "path": "./src/stories/Button.tsx",
        },
      ],
      "imports": [
        "import { Button } from "@design-system/components/override";",
      ],
    }
  `
  );
});

test('Keeps relative import when packageName is missing', () => {
  const code = dedent`
    import { Button } from './components/Button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "./components/Button",
          "importName": "Button",
          "isPackage": false,
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import { Button } from "./components/Button";",
      ],
    }
  `
  );
});

test('Non-relative import remains unchanged even if packageName provided', () => {
  const code = dedent`
    import { Header } from '@ds/header';

    const meta = {};
    export default meta;
    export const S = <Header/>;
  `;
  expect(getImports(code, 'my-package')).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Header",
          "importId": "@ds/header",
          "importName": "Header",
          "importOverride": undefined,
          "isPackage": true,
          "localImportName": "Header",
          "path": "./src/stories/Header.tsx",
        },
      ],
      "imports": [
        "import { Header } from "@ds/header";",
      ],
    }
  `
  );
});

test('Rewrites tilde-prefixed source to packageName', () => {
  const code = dedent`
    import { Button } from '~/components/Button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(getImports(code, 'pkg')).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "~/components/Button",
          "importName": "Button",
          "isPackage": false,
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import { Button } from "pkg";",
      ],
    }
  `
  );
});

test('Rewrites hash-prefixed source to packageName', () => {
  const code = dedent`
    import Btn from '#Button';

    const meta = {};
    export default meta;
    export const S = <Btn/>;
  `;
  expect(getImports(code, 'my-package')).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Btn",
          "importId": "#Button",
          "importName": "default",
          "isPackage": false,
          "localImportName": "Btn",
        },
      ],
      "imports": [
        "import { Btn } from "my-package";",
      ],
    }
  `
  );
});

test('Does not rewrite scoped package subpath (valid bare specifier)', () => {
  const code = dedent`
    import { Button } from '@scope/ui/components';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(getImports(code, 'pkg')).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@scope/ui/components",
          "importName": "Button",
          "isPackage": false,
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import { Button } from "pkg";",
      ],
    }
  `
  );
});

test('Does not rewrite unscoped package subpath (valid bare specifier)', () => {
  const code = dedent`
    import { Button } from 'ui/components';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(getImports(code, 'pkg')).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "ui/components",
          "importName": "Button",
          "isPackage": false,
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import { Button } from "pkg";",
      ],
    }
  `
  );
});

// Merging imports from same package

test('Merges multiple imports from the same package (defaults and named)', () => {
  const code = dedent`
    import { CopilotIcon } from '@primer/octicons-react';
    import { Banner } from "@primer/react";
    import Link from "@primer/react";
    import { Dialog } from "@primer/react";
    import { Stack } from "@primer/react";
    import { Heading } from "@primer/react";

    const meta = {};
    export default meta;
    export const S = <div><Link/><Heading/><Banner/><Dialog/><Stack/><CopilotIcon/></div>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Banner",
          "importId": "@primer/react",
          "importName": "Banner",
          "isPackage": false,
          "localImportName": "Banner",
        },
        {
          "componentName": "CopilotIcon",
          "importId": "@primer/octicons-react",
          "importName": "CopilotIcon",
          "isPackage": false,
          "localImportName": "CopilotIcon",
        },
        {
          "componentName": "Dialog",
          "importId": "@primer/react",
          "importName": "Dialog",
          "isPackage": false,
          "localImportName": "Dialog",
        },
        {
          "componentName": "Heading",
          "importId": "@primer/react",
          "importName": "Heading",
          "isPackage": false,
          "localImportName": "Heading",
        },
        {
          "componentName": "Link",
          "importId": "@primer/react",
          "importName": "default",
          "isPackage": false,
          "localImportName": "Link",
        },
        {
          "componentName": "Stack",
          "importId": "@primer/react",
          "importName": "Stack",
          "isPackage": false,
          "localImportName": "Stack",
        },
      ],
      "imports": [
        "import Link, { Banner, Dialog, Heading, Stack } from "@primer/react";",
        "import { CopilotIcon } from "@primer/octicons-react";",
      ],
    }
  `
  );
});

test('Handle namespace with default and separates named for same package', () => {
  const code = dedent`
    import * as PR from '@primer/react';
    import { Banner } from '@primer/react';
    import Link from '.';

    const meta = {};
    export default meta;
    export const S = <div><Link/><PR.Box/><Banner/></div>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Banner",
          "importId": "@primer/react",
          "importName": "Banner",
          "isPackage": false,
          "localImportName": "Banner",
        },
        {
          "componentName": "Link",
          "importId": ".",
          "importName": "default",
          "isPackage": false,
          "localImportName": "Link",
        },
        {
          "componentName": "PR.Box",
          "importId": "@primer/react",
          "importName": "Box",
          "isPackage": false,
          "localImportName": "PR",
          "namespace": "PR",
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

test('Component not imported returns undefined importId and importName', () => {
  const code = dedent`
    const meta = {};
    export default meta;
    export const S = <Missing/>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Missing",
          "isPackage": false,
        },
      ],
      "imports": [],
    }
  `
  );
});

test('Namespace component not imported returns undefined importId and importName', () => {
  const code = dedent`
    const meta = {};
    export default meta;
    export const S = <PR.Box/>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "PR.Box",
          "isPackage": false,
        },
      ],
      "imports": [],
    }
  `
  );
});

test('Filters out locally defined components', () => {
  const code = dedent`
    const Local = () => <div/>;

    const meta = { component: Local };
    export default meta;
    export const S = <Local/>;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [],
      "imports": [],
    }
    `
  );
});

test('importOverride: default override forces default import (keeps local name)', () => {
  const code = dedent`
    import { Button } from './Button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  const csf = loadCsf(code, { makeTitle: (t) => t ?? 'No title' }).parse();
  const base = getComponentData({
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

test('importOverride: named override aliases imported to local name', () => {
  const code = dedent`
    import Button from './Button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  const csf = loadCsf(code, { makeTitle: (t) => t ?? 'No title' }).parse();
  const base = getComponentData({
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

test('importOverride: uses namespace override as-is', () => {
  const code = dedent`
    import * as UI from './ui';

    const meta = {};
    export default meta;
    export const S = <UI.Button/>;
  `;
  const csf = loadCsf(code, { makeTitle: (t) => t ?? 'No title' }).parse();
  const discovered = getComponentData({
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
      "import * as UI from \"@pkg/ui\";",
    ]
  `);
});

test('importOverride: malformed string is ignored and behavior falls back', () => {
  const code = dedent`
    import { Header } from './Header';

    const meta = {};
    export default meta;
    export const S = <Header/>;
  `;
  const csf = loadCsf(code, { makeTitle: (t) => t ?? 'No title' }).parse();
  const base = getComponentData({
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

test('importOverride: merges multiple components into a single declaration per source', () => {
  const code = dedent`
    import Button from './Button';
    import { Header } from './Header';

    const meta = {};
    export default meta;
    export const A = <Button/>;
    export const B = <Header/>;
  `;
  const csf = loadCsf(code, { makeTitle: (t) => t ?? 'No title' }).parse();
  const base = getComponentData({
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
