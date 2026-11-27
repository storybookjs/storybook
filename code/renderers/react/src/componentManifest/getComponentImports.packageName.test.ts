import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { findTsconfigPathForPath } from 'storybook/internal/common';
import { loadCsf } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';
import { createMatchPath, loadConfig } from 'tsconfig-paths';

import { getComponentData } from './getComponentImports.ts';
import { setupMemfsMocks } from './memfs-test-setup.ts';
import { cachedResolveImport } from './utils.ts';

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
      paths: { '@/*': ['src/*'], '@acme/icons': ['packages/icons/src'] },
    });
    vi.mocked(createMatchPath).mockReturnValue((id) => {
      if (id === '@acme/icons') {
        return '/app/packages/icons/src/index.ts';
      }
      return typeof id === 'string' && id.startsWith('@/')
        ? '/app/src/components/Button.tsx'
        : undefined;
    });
    const resolveImport = vi.mocked(cachedResolveImport).getMockImplementation();
    vi.mocked(cachedResolveImport).mockImplementation((id, options) => {
      if (id === '@acme/icons') {
        return './packages/icons/src/index.ts';
      }
      if (!resolveImport) {
        throw new Error(`Unable to resolve ${String(id)}`);
      }
      return resolveImport(id, options);
    });
  });

  afterEach(() => {
    vi.mocked(findTsconfigPathForPath).mockRestore();
    vi.mocked(loadConfig).mockRestore();
    vi.mocked(createMatchPath).mockRestore();
    vi.mocked(cachedResolveImport).mockRestore();
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

  test('Keeps a tsconfig path that resolves as a package', async () => {
    const code = dedent`
      import { Icon } from '@acme/icons';

      const meta = {};
      export default meta;
      export const S = <Icon/>;
    `;
    expect(await getImports(code, 'pkg')).toMatchInlineSnapshot(`
      {
        "components": [
          {
            "componentName": "Icon",
            "importId": "@acme/icons",
            "importName": "Icon",
            "isPackage": true,
            "jsxDepth": 0,
            "localImportName": "Icon",
          },
        ],
        "imports": [
          "import { Icon } from '@acme/icons';",
        ],
      }
    `);
  });
});

describe('tsconfig path key when the file lookup misses', () => {
  beforeEach(() => {
    vi.mocked(findTsconfigPathForPath).mockReturnValue('/app/tsconfig.json');
    vi.mocked(loadConfig).mockReturnValue({
      resultType: 'success',
      configFileAbsolutePath: '/app/tsconfig.json',
      baseUrl: '.',
      absoluteBaseUrl: '/app',
      paths: { '@/*': ['${configDir}/src/*'], '@acme/icons': ['packages/icons/src'] },
    });
    vi.mocked(createMatchPath).mockReturnValue(() => undefined);
    const resolveImport = vi.mocked(cachedResolveImport).getMockImplementation();
    vi.mocked(cachedResolveImport).mockImplementation((id, options) => {
      if (id === '@acme/icons') {
        return './packages/icons/src/index.ts';
      }
      if (!resolveImport) {
        throw new Error(`Unable to resolve ${String(id)}`);
      }
      return resolveImport(id, options);
    });
  });

  afterEach(() => {
    vi.mocked(findTsconfigPathForPath).mockRestore();
    vi.mocked(loadConfig).mockRestore();
    vi.mocked(createMatchPath).mockRestore();
    vi.mocked(cachedResolveImport).mockRestore();
  });

  test('Rewrites a paths alias when the file lookup misses', async () => {
    const code = dedent`
      import { Button } from '@/ui';

      const meta = {};
      export default meta;
      export const S = <Button/>;
    `;
    expect(await getImports(code, 'pkg')).toMatchInlineSnapshot(`
      {
        "components": [
          {
            "componentName": "Button",
            "importId": "@/ui",
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

  test('Keeps a paths key Node resolves when the file lookup misses', async () => {
    const code = dedent`
      import { Icon } from '@acme/icons';

      const meta = {};
      export default meta;
      export const S = <Icon/>;
    `;
    const { components, imports } = await getImports(code, 'pkg');
    expect(imports).toEqual(["import { Icon } from '@acme/icons';"]);
    expect(components[0]).toMatchObject({
      importId: '@acme/icons',
      isPackage: true,
    });
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
