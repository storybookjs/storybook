import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deprecate } from 'storybook/internal/node-logger';

import { transform } from 'esbuild';

import {
  addExtensionsToRelativeImports,
  clearDirectoryCache,
  load,
  resolveWithExtension,
} from './loader.ts';

// Mock dependencies
vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('storybook/internal/node-logger');
vi.mock('esbuild');

describe('loader', () => {
  beforeEach(() => {
    clearDirectoryCache();
  });

  describe('load', () => {
    const nextLoad = vi.fn();

    beforeEach(() => {
      nextLoad.mockReset();
      vi.mocked(readFile).mockResolvedValue('const x: number = 1;');
      vi.mocked(transform).mockResolvedValue({
        code: 'const x = 1;',
        map: '',
        warnings: [],
      } as any);
    });

    it('transforms a plain .ts URL with esbuild', async () => {
      const result = await load('file:///project/main.ts', {} as any, nextLoad);

      expect(transform).toHaveBeenCalled();
      expect(nextLoad).not.toHaveBeenCalled();
      expect(result).toMatchObject({ format: 'module', shortCircuit: true });
    });

    it('still transforms a .ts URL with a cache-busting query string appended', async () => {
      // Regression test: importModule appends `?<timestamp>` to bust the module cache when
      // skipCache is set. That must not cause this loader to skip the file and fall through to
      // Node's native handling, which does not elide type-only named imports the way esbuild does.
      const result = await load('file:///project/main.ts?1234567890', {} as any, nextLoad);

      expect(readFile).toHaveBeenCalledWith('/project/main.ts', 'utf-8');
      expect(transform).toHaveBeenCalled();
      expect(nextLoad).not.toHaveBeenCalled();
      expect(result).toMatchObject({ format: 'module', shortCircuit: true });
    });

    it('delegates non-TS URLs to nextLoad', async () => {
      nextLoad.mockResolvedValue({ format: 'module', shortCircuit: true, source: '' });

      await load('file:///project/main.js', {} as any, nextLoad);

      expect(transform).not.toHaveBeenCalled();
      expect(nextLoad).toHaveBeenCalledWith('file:///project/main.js', {});
    });
  });

  describe('resolveWithExtension', () => {
    it('should return the path as-is if it already has an extension', () => {
      const result = resolveWithExtension('./test.js', '/project/src/file.ts');

      expect(result).toBe('./test.js');
      expect(deprecate).not.toHaveBeenCalled();
    });

    it('should resolve extensionless import to .ts extension when file exists', () => {
      vi.mocked(readdirSync).mockReturnValue(['utils.ts'] as any);

      const result = resolveWithExtension('./utils', '/project/src/file.ts');

      expect(result).toBe('./utils.ts');
      expect(deprecate).toHaveBeenCalledWith(
        expect.stringContaining('One or more extensionless imports detected: "./utils"')
      );
    });

    it('should resolve extensionless import to .js extension when file exists', () => {
      vi.mocked(readdirSync).mockReturnValue(['utils.js'] as any);

      const result = resolveWithExtension('./utils', '/project/src/file.ts');

      expect(result).toBe('./utils.js');
      expect(deprecate).toHaveBeenCalledWith(
        expect.stringContaining('One or more extensionless imports detected: "./utils"')
      );
    });

    it('should show deprecation message when encountering an extensionless import', () => {
      vi.mocked(readdirSync).mockReturnValue(['utils.js'] as any);

      resolveWithExtension('./utils', '/project/src/file.ts');

      expect(deprecate).toHaveBeenCalledWith(
        expect.stringContaining('One or more extensionless imports detected: "./utils"')
      );
      expect(deprecate).toHaveBeenCalledWith(
        expect.stringContaining('in file "/project/src/file.ts"')
      );
    });

    it('should return original path when file cannot be resolved', () => {
      vi.mocked(readdirSync).mockReturnValue([] as any);

      const result = resolveWithExtension('./missing', '/project/src/file.ts');

      expect(result).toBe('./missing');
      expect(deprecate).toHaveBeenCalledWith(
        expect.stringContaining('One or more extensionless imports detected: "./missing"')
      );
    });

    it('should resolve relative to parent directory', () => {
      vi.mocked(readdirSync).mockReturnValue(['utils.ts'] as any);

      const result = resolveWithExtension('../utils', '/project/src/file.ts');

      expect(result).toBe('../utils.ts');
      expect(deprecate).toHaveBeenCalledWith(
        expect.stringContaining('One or more extensionless imports detected: "../utils"')
      );
    });
  });

  describe('addExtensionsToRelativeImports', () => {
    beforeEach(() => {
      // Default: directory listings contain .ts versions of common test filenames
      vi.mocked(readdirSync).mockReturnValue([
        'utils.ts',
        'foo.ts',
        'bar.ts',
        'baz.ts',
        'module.ts',
        'styles.ts',
        'test.ts',
      ] as any);
    });

    it('should not modify imports that already have non-mapped extensions', () => {
      const testCases = [
        { input: `import foo from './test.ts';`, expected: `import foo from './test.ts';` },
        { input: `import foo from '../utils.mjs';`, expected: `import foo from '../utils.mjs';` },
        {
          input: `export { bar } from './module.tsx';`,
          expected: `export { bar } from './module.tsx';`,
        },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = addExtensionsToRelativeImports(input, '/project/src/file.ts');
        expect(result).toBe(expected);
        expect(deprecate).not.toHaveBeenCalled();
      });
    });

    it('should resolve .js imports to .ts when TypeScript alternative exists', () => {
      const result = addExtensionsToRelativeImports(
        `import foo from './test.js';`,
        '/project/src/file.ts'
      );

      expect(result).toBe(`import foo from './test.ts';`);
      expect(deprecate).not.toHaveBeenCalled();
    });

    it('should add extension to static import statements', () => {
      const source = `import { foo } from './utils';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`import { foo } from './utils.ts';`);
    });

    it('should add extension to static export statements', () => {
      const source = `export { foo } from './utils';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`export { foo } from './utils.ts';`);
    });

    it('should add extension to dynamic import statements', () => {
      const source = `const module = await import('./utils');`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`const module = await import('./utils.ts');`);
    });

    it('should handle default imports', () => {
      const source = `import foo from './module';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`import foo from './module.ts';`);
    });

    it('should handle named imports', () => {
      const source = `import { foo, bar } from './module';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`import { foo, bar } from './module.ts';`);
    });

    it('should handle namespace imports', () => {
      const source = `import * as utils from './module';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`import * as utils from './module.ts';`);
    });

    it('should handle side-effect imports', () => {
      const source = `import './styles';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`import './styles.ts';`);
    });

    it('should handle export all statements', () => {
      const source = `export * from './module';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`export * from './module.ts';`);
    });

    it('should not modify absolute imports', () => {
      const testCases = [
        `import foo from 'react';`,
        `import bar from '@storybook/react';`,
        `import baz from 'node:fs';`,
      ];

      testCases.forEach((source) => {
        const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');
        expect(result).toBe(source);
      });
    });

    it('should not modify imports that match the pattern but are not relative paths', () => {
      // Edge case: a path that starts with a dot but not ./ or ../
      // This tests the condition that returns 'match' unchanged
      const source = `import foo from '.config';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      // Should not be modified since it doesn't start with ./ or ../
      expect(result).toBe(source);
      expect(deprecate).not.toHaveBeenCalled();
    });

    it('should handle single quotes', () => {
      const source = `import foo from './utils';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`import foo from './utils.ts';`);
    });

    it('should handle double quotes', () => {
      const source = `import foo from "./utils";`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`import foo from "./utils.ts";`);
    });

    it('should handle paths starting with ./', () => {
      const source = `import foo from './utils';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`import foo from './utils.ts';`);
    });

    it('should handle paths starting with ../', () => {
      const source = `import foo from '../utils';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`import foo from '../utils.ts';`);
    });

    it('should handle multiple imports in the same file', () => {
      const source = `import foo from './foo';\nimport bar from './bar';\nexport { baz } from '../baz';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(
        `import foo from './foo.ts';\nimport bar from './bar.ts';\nexport { baz } from '../baz.ts';`
      );
    });

    it('should preserve the import structure after adding extensions', () => {
      const source = `import { foo, bar } from './utils';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toContain('{ foo, bar }');
      expect(result).toBe(`import { foo, bar } from './utils.ts';`);
    });

    it('should handle imports with comments', () => {
      const source = `// This is a comment\nimport foo from './utils'; // inline comment`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`// This is a comment\nimport foo from './utils.ts'; // inline comment`);
    });

    it('should handle multi-line imports with named exports on separate lines', () => {
      const source = `import {
  foo,
  bar,
  baz
} from './utils';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`import {
  foo,
  bar,
  baz
} from './utils.ts';`);
    });

    it('should handle multi-line exports with named exports on separate lines', () => {
      const source = `export {
  foo,
  bar
} from '../module';`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`export {
  foo,
  bar
} from '../module.ts';`);
    });

    it('should handle multi-line dynamic imports', () => {
      const source = `const module = await import(
  './utils'
);`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`const module = await import(
  './utils.ts'
);`);
    });

    it('should handle dynamic imports with backticks', () => {
      const source = 'import(`./foo`);';
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe('import(`./foo.ts`);');
    });

    it('should not modify dynamic imports with template literal interpolation', () => {
      const source = 'import(`${foo}/bar`);';
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      // Cannot be supported: template interpolation ${foo} is a runtime value
      // The regex stops at $ to avoid matching interpolated expressions
      expect(result).toBe('import(`${foo}/bar`);');
    });

    it('should not modify dynamic imports with template literal interpolation and relative path', () => {
      const source = 'import(`./${foo}/bar`);';
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      // Cannot be supported: template interpolation ${foo} is a runtime value
      // The regex stops at $ to avoid matching interpolated expressions
      expect(result).toBe('import(`./${foo}/bar`);');
    });

    it('should handle array of dynamic imports', () => {
      const source = `const [] = [
  import('./foo'),
  import('./bar'),
];`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(`const [] = [
  import('./foo.ts'),
  import('./bar.ts'),
];`);
    });

    it('should handle multi-line backtick dynamic imports', () => {
      const source = 'const module = await import(\n  `./utils`\n);';
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe('const module = await import(\n  `./utils.ts`\n);');
    });

    it('should handle mixed quote types in same file', () => {
      const source = `import foo from './foo';\nimport bar from "./bar";\nimport(\`./baz\`);`;
      const result = addExtensionsToRelativeImports(source, '/project/src/file.ts');

      expect(result).toBe(
        `import foo from './foo.ts';\nimport bar from "./bar.ts";\nimport(\`./baz.ts\`);`
      );
    });
  });
});
