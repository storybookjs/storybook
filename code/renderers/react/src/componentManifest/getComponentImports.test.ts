import { expect, test } from 'vitest';

import { loadCsf } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { getComponentImports } from './getComponentImports';

const getImports = (code: string, packageName?: string) =>
  getComponentImports(
    loadCsf(code, { makeTitle: (t?: string) => t ?? 'title' }).parse(),
    packageName
  );

test('Get imports from multiple components', () => {
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
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@design-system/button",
          "importName": "Button",
          "localImportName": "Button",
        },
        {
          "componentName": "ButtonGroup",
          "importId": "@design-system/button-group",
          "importName": "ButtonGroup",
          "localImportName": "ButtonGroup",
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

test('Namespace import with member usage', () => {
  const code = dedent`
    import * as Accordion from '@ds/accordion';

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
          "importId": "@ds/accordion",
          "importName": "Root",
          "localImportName": "Accordion",
          "namespace": "Accordion",
        },
      ],
      "imports": [
        "import * as Accordion from "@ds/accordion";",
      ],
    }
  `
  );
});

test('Named import used as namespace object', () => {
  const code = dedent`
    import { Accordion } from '@ds/accordion';

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
          "importId": "@ds/accordion",
          "importName": "Accordion",
          "localImportName": "Accordion",
        },
      ],
      "imports": [
        "import { Accordion } from "@ds/accordion";",
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
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import Button from "@ds/button";",
      ],
    }
  `
  );
});

test('Alias named import and meta.component inclusion', () => {
  const code = dedent`
    import DefaultComponent, { Button as Btn, Other } from '@ds/button';

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
          "localImportName": "Btn",
        },
        {
          "componentName": "Other",
          "importId": "@ds/button",
          "importName": "Other",
          "localImportName": "Other",
        },
      ],
      "imports": [
        "import { Button as Btn, Other } from "@ds/button";",
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
          "localImportName": "Btn",
        },
      ],
      "imports": [
        "import { Button as Btn } from "@ds/button";",
      ],
    }
  `
  );
});

test('Meta component with member and star import', () => {
  const code = dedent`
    import * as Accordion from '@ds/accordion';

    const meta = { component: Accordion.Root };
    export default meta;
  `;
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Accordion.Root",
          "importId": "@ds/accordion",
          "importName": "Root",
          "localImportName": "Accordion",
          "namespace": "Accordion",
        },
      ],
      "imports": [
        "import * as Accordion from "@ds/accordion";",
      ],
    }
  `
  );
});

test('Keeps multiple named specifiers and drops unused ones from same import', () => {
  const code = dedent`
    import { Button, ButtonGroup, useHook } from '@ds/button';

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
          "localImportName": "Button",
        },
        {
          "componentName": "ButtonGroup",
          "importId": "@ds/button",
          "importName": "ButtonGroup",
          "localImportName": "ButtonGroup",
        },
      ],
      "imports": [
        "import { Button, ButtonGroup } from "@ds/button";",
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
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import Button from "@ds/button";",
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
          "localImportName": "Btn",
        },
      ],
      "imports": [
        "import { Button as Btn } from "@ds/button";",
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
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import { Button } from "@ds/button";",
      ],
    }
  `
  );
});

test('Namespace import used for multiple members kept once', () => {
  const code = dedent`
    import * as DS from '@ds/ds';

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
          "importId": "@ds/ds",
          "importName": "A",
          "localImportName": "DS",
          "namespace": "DS",
        },
        {
          "componentName": "DS.B",
          "importId": "@ds/ds",
          "importName": "B",
          "localImportName": "DS",
          "namespace": "DS",
        },
      ],
      "imports": [
        "import * as DS from "@ds/ds";",
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
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import Button from "@ds/button";",
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
          "localImportName": "Button",
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

test('Converts default relative import to named when packageName provided', () => {
  const code = dedent`
    import Header from './Header';

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
          "importId": "./Header",
          "importName": "default",
          "localImportName": "Header",
        },
      ],
      "imports": [
        "import { Header } from "my-package";",
      ],
    }
  `
  );
});

test('Converts relative import to provided packageName', () => {
  const code = dedent`
    import { Button } from './components/Button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(getImports(code, 'my-package')).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "./components/Button",
          "importName": "Button",
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import { Button } from "my-package";",
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
    import { Button } from '@ds/button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(getImports(code, 'my-package')).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@ds/button",
          "importName": "Button",
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import { Button } from "@ds/button";",
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
    import Heading from "@primer/react";

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
          "localImportName": "Banner",
        },
        {
          "componentName": "CopilotIcon",
          "importId": "@primer/octicons-react",
          "importName": "CopilotIcon",
          "localImportName": "CopilotIcon",
        },
        {
          "componentName": "Dialog",
          "importId": "@primer/react",
          "importName": "Dialog",
          "localImportName": "Dialog",
        },
        {
          "componentName": "Heading",
          "importId": "@primer/react",
          "importName": "default",
          "localImportName": "Heading",
        },
        {
          "componentName": "Link",
          "importId": "@primer/react",
          "importName": "default",
          "localImportName": "Link",
        },
        {
          "componentName": "Stack",
          "importId": "@primer/react",
          "importName": "Stack",
          "localImportName": "Stack",
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

test('Merges namespace with default and separates named for same package', () => {
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
          "localImportName": "Banner",
        },
        {
          "componentName": "Link",
          "importId": ".",
          "importName": "default",
          "localImportName": "Link",
        },
        {
          "componentName": "PR.Box",
          "importId": "@primer/react",
          "importName": "Box",
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

test('Object.assign aliasing of imported component retains correct import', () => {
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
  expect(getImports(code)).toMatchInlineSnapshot(
    `
    {
      "components": [],
      "imports": [],
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
