import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { findTsconfigPathForPath } from 'storybook/internal/common';
import { loadCsf } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';
import { createMatchPath, loadConfig } from 'tsconfig-paths';

import { getComponentData } from './getComponentImports.ts';
import { setupMemfsMocks } from './memfs-test-setup.ts';

vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock(import('./utils.ts'), { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('empathic/find', { spy: true });
vi.mock('tsconfig-paths', { spy: true });

beforeEach(() => {
  setupMemfsMocks();
});

const getImports = async (code: string, packageName?: string, storyFilePath?: string) => {
  storyFilePath ??= '/app/src/stories/Button.stories.tsx';
  const { components, imports } = await getComponentData({
    csf: loadCsf(code, { makeTitle: (t?: string) => t ?? 'title' }).parse(),
    packageName,
    storyFilePath,
    docgenEngine: 'react-docgen',
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return { components: components.map(({ reactDocgen, ...rest }) => rest), imports };
};

test('Converts default relative import to import override when provided', async () => {
  const code = dedent`
    import Button from './Button';

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
          "importName": "default",
          "importOverride": "import { Button } from '@design-system/components/override';",
          "isPackage": false,
          "jsxDepth": 0,
          "localImportName": "Button",
          "path": "./src/stories/Button.tsx",
        },
      ],
      "imports": [
        "import { Button } from '@design-system/components/override';",
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
          "isPackage": false,
          "jsxDepth": 0,
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import { Button } from './components/Button';",
      ],
    }
  `
  );
});

test('Non-relative import remains unchanged even if packageName provided', async () => {
  const code = dedent`
    import { Header } from '@ds/header';

    const meta = {};
    export default meta;
    export const S = <Header/>;
  `;
  expect(await getImports(code, 'my-package')).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Header",
          "importId": "@ds/header",
          "importName": "Header",
          "importOverride": undefined,
          "isPackage": true,
          "jsxDepth": 0,
          "localImportName": "Header",
          "path": "./src/stories/Header.tsx",
        },
      ],
      "imports": [
        "import { Header } from '@ds/header';",
      ],
    }
  `
  );
});

test('Rewrites tilde-prefixed source to packageName', async () => {
  const code = dedent`
    import { Button } from '~/components/Button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(await getImports(code, 'pkg')).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "~/components/Button",
          "importName": "Button",
          "isPackage": false,
          "jsxDepth": 0,
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import { Button } from 'pkg';",
      ],
    }
  `
  );
});

test('Rewrites hash-prefixed source to packageName', async () => {
  const code = dedent`
    import Btn from '#Button';

    const meta = {};
    export default meta;
    export const S = <Btn/>;
  `;
  expect(await getImports(code, 'my-package')).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Btn",
          "importId": "#Button",
          "importName": "default",
          "isPackage": false,
          "jsxDepth": 0,
          "localImportName": "Btn",
        },
      ],
      "imports": [
        "import { Btn } from 'my-package';",
      ],
    }
  `
  );
});

test('Does not rewrite scoped package subpath (valid bare specifier)', async () => {
  const code = dedent`
    import { Button } from '@scope/ui/components';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(await getImports(code, 'pkg')).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "@scope/ui/components",
          "importName": "Button",
          "isPackage": true,
          "jsxDepth": 0,
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import { Button } from '@scope/ui/components';",
      ],
    }
  `
  );
});

test('Does not rewrite unscoped package subpath (valid bare specifier)', async () => {
  const code = dedent`
    import { Button } from 'ui/components';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(await getImports(code, 'pkg')).toMatchInlineSnapshot(
    `
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "ui/components",
          "importName": "Button",
          "isPackage": true,
          "jsxDepth": 0,
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import { Button } from 'ui/components';",
      ],
    }
  `
  );
});

test('Keeps an unresolved package specifier', async () => {
  const code = dedent`
    import { MemoryRouter } from 'react-router-dom';

    const meta = {};
    export default meta;
    export const S = <MemoryRouter/>;
  `;
  expect(await getImports(code, 'pkg')).toMatchInlineSnapshot(`
    {
      "components": [
        {
          "componentName": "MemoryRouter",
          "importId": "react-router-dom",
          "importName": "MemoryRouter",
          "isPackage": true,
          "jsxDepth": 0,
          "localImportName": "MemoryRouter",
        },
      ],
      "imports": [
        "import { MemoryRouter } from 'react-router-dom';",
      ],
    }
  `);
});

describe('tsconfig path alias', () => {
  beforeEach(() => {
    vi.mocked(findTsconfigPathForPath).mockReturnValue('/app/tsconfig.json');
    vi.mocked(loadConfig).mockReturnValue({
      resultType: 'success',
      configFileAbsolutePath: '/app/tsconfig.json',
      baseUrl: '.',
      absoluteBaseUrl: '/app',
      paths: { '@/*': ['src/*'] },
    });
    vi.mocked(createMatchPath).mockReturnValue((id) =>
      typeof id === 'string' && id.startsWith('@/') ? '/app/src/components/Button.tsx' : undefined
    );
  });

  afterEach(() => {
    vi.mocked(findTsconfigPathForPath).mockRestore();
    vi.mocked(loadConfig).mockRestore();
    vi.mocked(createMatchPath).mockRestore();
  });

  test('Rewrites a tsconfig path alias to packageName', async () => {
    const code = dedent`
      import { Button } from '@/components/Button';

      const meta = {};
      export default meta;
      export const S = <Button/>;
    `;
    expect(await getImports(code, 'pkg')).toMatchInlineSnapshot(`
      {
        "components": [
          {
            "componentName": "Button",
            "importId": "@/components/Button",
            "importName": "Button",
            "isPackage": false,
            "jsxDepth": 0,
            "localImportName": "Button",
          },
        ],
        "imports": [
          "import { Button } from 'pkg';",
        ],
      }
    `);
  });
});

test('Rewrites a Windows network path to packageName', async () => {
  const code = dedent`
    import Button from '\\\\\\\\server\\\\share\\\\Button';

    const meta = {};
    export default meta;
    export const S = <Button/>;
  `;
  expect(await getImports(code, 'pkg')).toMatchInlineSnapshot(`
    {
      "components": [
        {
          "componentName": "Button",
          "importId": "\\\\server\\share\\Button",
          "importName": "default",
          "isPackage": false,
          "jsxDepth": 0,
          "localImportName": "Button",
        },
      ],
      "imports": [
        "import { Button } from 'pkg';",
      ],
    }
  `);
});
