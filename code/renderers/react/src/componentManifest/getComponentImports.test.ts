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
          "importId": "@design-system/button",
          "importName": "Button",
          "localName": "Button",
        },
        {
          "importId": "@design-system/button-group",
          "importName": "ButtonGroup",
          "localName": "ButtonGroup",
        },
      ],
      "imports": [
        "import { ButtonGroup } from '@design-system/button-group';",
        "import { Button } from '@design-system/button';",
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
          "importId": "@ds/accordion",
          "importName": "Root",
          "localName": "Accordion.Root",
        },
      ],
      "imports": [
        "import * as Accordion from '@ds/accordion';",
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
          "importId": "@ds/accordion",
          "importName": "Root",
          "localName": "Accordion.Root",
        },
      ],
      "imports": [
        "import { Accordion } from '@ds/accordion';",
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
          "importId": "@ds/button",
          "importName": "default",
          "localName": "Button",
        },
      ],
      "imports": [
        "import Button from '@ds/button';",
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
          "importId": "@ds/button",
          "importName": "Button",
          "localName": "Btn",
        },
        {
          "importId": "@ds/button",
          "importName": "Other",
          "localName": "Other",
        },
      ],
      "imports": [
        "import { Button as Btn, Other } from '@ds/button';",
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
          "importId": "@ds/button",
          "importName": "Button",
          "localName": "Btn",
        },
      ],
      "imports": [
        "import { Button as Btn } from '@ds/button';",
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
          "importId": "@ds/accordion",
          "importName": "Root",
          "localName": "Accordion.Root",
        },
      ],
      "imports": [
        "import * as Accordion from '@ds/accordion';",
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
          "importId": "@ds/button",
          "importName": "Button",
          "localName": "Button",
        },
        {
          "importId": "@ds/button",
          "importName": "ButtonGroup",
          "localName": "ButtonGroup",
        },
      ],
      "imports": [
        "import { Button, ButtonGroup } from '@ds/button';",
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
          "importId": "@ds/button",
          "importName": "default",
          "localName": "Button",
        },
      ],
      "imports": [
        "import Button from '@ds/button';",
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
          "importId": "@ds/button",
          "importName": "Button",
          "localName": "Btn",
        },
      ],
      "imports": [
        "import { Button as Btn } from '@ds/button';",
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
          "importId": "@ds/button",
          "importName": "Button",
          "localName": "Button",
        },
      ],
      "imports": [
        "import { Button } from '@ds/button';",
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
          "importId": "@ds/ds",
          "importName": "A",
          "localName": "DS.A",
        },
        {
          "importId": "@ds/ds",
          "importName": "B",
          "localName": "DS.B",
        },
      ],
      "imports": [
        "import * as DS from '@ds/ds';",
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
          "importId": "@ds/button",
          "importName": "default",
          "localName": "Button",
        },
      ],
      "imports": [
        "import Button from '@ds/button';",
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
          "importId": "@ds/button",
          "importName": "Button",
          "localName": "Button",
        },
      ],
      "imports": [
        "import { Button } from '@ds/button';",
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
          "importId": "./Header",
          "importName": "Header",
          "localName": "Header",
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
          "importId": "./components/Button",
          "importName": "Button",
          "localName": "Button",
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
          "importId": "./components/Button",
          "importName": "Button",
          "localName": "Button",
        },
      ],
      "imports": [
        "import { Button } from './components/Button';",
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
          "importId": "@ds/button",
          "importName": "Button",
          "localName": "Button",
        },
      ],
      "imports": [
        "import { Button } from '@ds/button';",
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
          "importId": "@primer/react",
          "importName": "Banner",
          "localName": "Banner",
        },
        {
          "importId": "@primer/octicons-react",
          "importName": "CopilotIcon",
          "localName": "CopilotIcon",
        },
        {
          "importId": "@primer/react",
          "importName": "Dialog",
          "localName": "Dialog",
        },
        {
          "importId": "@primer/react",
          "importName": "default",
          "localName": "Heading",
        },
        {
          "importId": "@primer/react",
          "importName": "default",
          "localName": "Link",
        },
        {
          "importId": "@primer/react",
          "importName": "Stack",
          "localName": "Stack",
        },
      ],
      "imports": [
        "import { CopilotIcon } from '@primer/octicons-react';",
        "import Link, { Banner, Dialog, Stack } from \"@primer/react\";",
        "import Heading from \"@primer/react\";",
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
          "importId": "@primer/react",
          "importName": "Banner",
          "localName": "Banner",
        },
        {
          "importId": ".",
          "importName": "default",
          "localName": "Link",
        },
        {
          "importId": "@primer/react",
          "importName": "Box",
          "localName": "PR.Box",
        },
      ],
      "imports": [
        "import * as PR from '@primer/react';",
        "import { Banner } from '@primer/react';",
        "import Link from '.';",
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
          "localName": "Missing",
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
          "importId": undefined,
          "importName": undefined,
          "localName": "PR.Box",
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
