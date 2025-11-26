import { existsSync } from 'node:fs';
import * as path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deprecate } from 'storybook/internal/node-logger';

import { addExtensionsToRelativeImports, resolveWithExtension } from './loader';

// Mock dependencies
vi.mock('node:fs');
vi.mock('storybook/internal/node-logger');

describe('loader', () => {
  describe('resolveWithExtension', () => {
    it('should return the path as-is if it already has an extension', () => {
      const result = resolveWithExtension('./test.js', '/project/src/file.ts');

      expect(result).toBe('./test.js');
      expect(deprecate).not.toHaveBeenCalled();
    });

    it('should resolve extensionless import to .ts extension when file exists', () => {
      const currentFile = '/project/src/file.ts';
      const expectedPath = path.resolve(path.dirname(currentFile), './utils.ts');

      vi.mocked(existsSync).mockImplementation((filePath) => {
        return filePath === expectedPath;
      });

      const result = resolveWithExtension('./utils', currentFile);

      expect(result).toBe('./utils.ts');
      expect(deprecate).toHaveBeenCalledWith(
        expect.stringContaining('One or more extensionless imports detected: "./utils"')
      );
      expect(deprecate).toHaveBeenCalledWith(
        expect.stringContaining(
          'For maximum compatibility, you should add an explicit file extension'
        )
      );
    });

    it('should resolve extensionless import to .js extension when file exists', () => {
      const currentFile = '/project/src/file.ts';
      const expectedPath = path.resolve(path.dirname(currentFile), './utils.js');

      vi.mocked(existsSync).mockImplementation((filePath) => {
        return filePath === expectedPath;
      });

      const result = resolveWithExtension('./utils', currentFile);

      expect(result).toBe('./utils.js');
      expect(deprecate).toHaveBeenCalledWith(
        expect.stringContaining('One or more extensionless imports detected: "./utils"')
      );
    });

    it('should show deprecation message when encountering an extensionless import', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      resolveWithExtension('./utils', '/project/src/file.ts');

      expect(deprecate).toHaveBeenCalledWith(
        expect.stringContaining('One or more extensionless imports detected: "./utils"')
      );
      expect(deprecate).toHaveBeenCalledWith(
        expect.stringContaining('in file "/project/src/file.ts"')
      );
    });

    it('should return original path when file cannot be resolved', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = resolveWithExtension('./missing', '/project/src/file.ts');

      expect(result).toBe('./missing');
      expect(deprecate).toHaveBeenCalledWith(
        expect.stringContaining('One or more extensionless imports detected: "./missing"')
      );
    });

    it('should resolve relative to parent directory', () => {
      const currentFile = '/project/src/file.ts';
      const expectedPath = path.resolve(path.dirname(currentFile), '../utils.ts');

      vi.mocked(existsSync).mockImplementation((filePath) => {
        return filePath === expectedPath;
      });

      const result = resolveWithExtension('../utils', currentFile);

      expect(result).toBe('../utils.ts');
      expect(deprecate).toHaveBeenCalledWith(
        expect.stringContaining('One or more extensionless imports detected: "../utils"')
      );
    });
  });

  describe('addExtensionsToRelativeImports', () => {
    beforeEach(() => {
      // Default: all files exist with .ts extension
      vi.mocked(existsSync).mockImplementation((filePath) => {
        return (filePath as string).endsWith('.ts');
      });
    });

    it('should not modify imports that already have extensions', () => {
      const testCases = [
        { input: `import foo from './test.js';`, expected: `import foo from './test.js';` },
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
