import { describe, expect, it } from 'vitest';

import { type E, parseModule } from '../csf-tools/estree/ast.ts';
import {
  canUpdateVitestConfigFile,
  findExportDefault,
  resolveExpression,
} from './vitest-config.ts';

const parse = (code: string) => parseModule(code, 'file.ts').program;

describe('canUpdateVitestConfigFile', () => {
  it('returns true for plain export default object literal', () => {
    expect(canUpdateVitestConfigFile('export default { test: { name: "node" } }')).toBe(true);
  });

  it('returns true for bare export default {}', () => {
    expect(canUpdateVitestConfigFile('export default {}')).toBe(true);
  });

  it('returns true for defineConfig({}) pattern', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { defineConfig } from 'vitest/config';
        export default defineConfig({ test: { environment: 'happy-dom' } });`
      )
    ).toBe(true);
  });

  it('returns true for defineProject({}) pattern', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { defineProject } from 'vitest/config';
        export default defineProject({ test: { environment: 'happy-dom' } });`
      )
    ).toBe(true);
  });

  it('returns true for defineProject from vitest/config', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { defineProject } from 'vitest/config';

        export default defineProject({
          test: {
            name: 'node',
            environment: 'happy-dom',
            include: ['**/*.test.ts'],
          },
        })
        `
      )
    ).toBe(true);
  });

  it('returns true for simple mergeConfig({}, {}) pattern', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { mergeConfig } from 'vitest/config';
        import viteConfig from './vite.config';
        export default mergeConfig(viteConfig, { test: { name: 'node' } });`
      )
    ).toBe(true);
  });

  it('returns true for defineConfig(mergeConfig(...)) pattern', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { defineConfig, mergeConfig } from 'vitest/config';
        import viteConfig from './vite.config';

        export default defineConfig(
          mergeConfig(viteConfig, {
            test: {
              name: 'node',
              environment: 'happy-dom',
              include: ['**/*.test.ts'],
            },
          })
        )
        `
      )
    ).toBe(true);
  });

  it('returns true for defineConfig(mergeConfig(...) satisfies ViteUserConfig) pattern', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { defineConfig, mergeConfig } from 'vitest/config';
        import type { ViteUserConfig } from 'vitest/config';
        import viteConfig from './vite.config';

        export default defineConfig(
          mergeConfig(viteConfig, {
            test: {
              name: 'node',
              environment: 'happy-dom',
              include: ['**/*.test.ts'],
            },
          }) satisfies ViteUserConfig
        )
        `
      )
    ).toBe(true);
  });

  it('returns true for mergeConfig(...) as ViteUserConfig pattern', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { mergeConfig } from 'vitest/config';
        import type { ViteUserConfig } from 'vitest/config';
        import viteConfig from './vite.config';

        export default mergeConfig(viteConfig, {
          test: {
            name: 'node',
            environment: 'happy-dom',
            include: ['**/*.test.ts'],
          },
        }) as ViteUserConfig
        `
      )
    ).toBe(true);
  });

  it('returns true for mergeConfig with shorthand test property (const test = {...})', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { mergeConfig } from 'vitest/config';
        import viteConfig from './vite.config';

        const test = {
          name: 'node',
          environment: 'happy-dom',
          include: ['**/*.test.ts'],
        };

        export default mergeConfig(viteConfig, {
          test,
        })
        `
      )
    ).toBe(true);
  });

  it('returns true for mergeConfig with external vitestConfig variable', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { mergeConfig } from 'vitest/config';
        import viteConfig from './vite.config';

        const vitestConfig = {
          test: {
            name: 'node',
            environment: 'happy-dom',
            include: ['**/*.test.ts'],
          },
        };

        export default mergeConfig(viteConfig, vitestConfig)
        `
      )
    ).toBe(true);
  });

  it('returns true for const config = mergeConfig(...); export default config pattern', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { defineConfig, mergeConfig } from 'vitest/config';
        import viteConfig from './vite.config';

        const config = mergeConfig(
          viteConfig,
          defineConfig({
            test: {
              name: 'node',
              environment: 'happy-dom',
              include: ['**/*.test.ts'],
            },
          })
        );

        export default config
      `
      )
    ).toBe(true);
  });

  it('returns true for export default config where config = defineConfig({...})', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { defineConfig } from 'vitest/config';

        const config = defineConfig({ test: { name: 'node' } });
        export default config
        `
      )
    ).toBe(true);
  });

  it('returns true for defineConfig({}) as UserWorkspaceConfig', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { defineConfig } from 'vitest/config';
        import type { UserWorkspaceConfig } from 'vitest/config';

        export default defineConfig({ test: {} }) as UserWorkspaceConfig
        `
      )
    ).toBe(true);
  });

  it('returns true for defineConfig({}) satisfies UserWorkspaceConfig', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { defineConfig } from 'vitest/config';
        import type { UserWorkspaceConfig } from 'vitest/config';

        export default defineConfig({ test: {} }) satisfies UserWorkspaceConfig
        `
      )
    ).toBe(true);
  });

  it('returns true for defineConfig aliased to a custom name', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { defineConfig as dc } from 'vitest/config';
        export default dc({ test: {} })
        `
      )
    ).toBe(true);
  });

  it('returns false when there is no export default', () => {
    expect(canUpdateVitestConfigFile('const x = 1;')).toBe(false);
  });

  it('returns true for arrow function pattern: defineConfig(({ mode }) => ({}))', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { defineConfig } from 'vitest/config';
        export default defineConfig(({ mode }) => ({
          test: {
            globals: mode !== 'production',
          },
        }))
        `
      )
    ).toBe(true);
  });

  it('returns false for callback pattern with dynamic control flow', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { defineConfig } from 'vitest/config';
        export default defineConfig(({ mode }) => {
          if (mode === 'production') {
            return { test: { name: 'prod' } };
          }
          return { test: { name: 'dev' } };
        })
        `
      )
    ).toBe(false);
  });

  it('returns false for unrecognizable export (string literal)', () => {
    expect(canUpdateVitestConfigFile("export default 'something'")).toBe(false);
  });

  it('returns false for syntax errors', () => {
    expect(canUpdateVitestConfigFile('this is not valid syntax !!!')).toBe(false);
  });

  it('returns false for export default function declaration', () => {
    expect(canUpdateVitestConfigFile('export default function config() { return {}; }')).toBe(
      false
    );
  });
});

describe('resolveExpression', () => {
  it('returns null for null/undefined input', () => {
    const ast = parse('');
    expect(resolveExpression(null, ast)).toBeNull();
    expect(resolveExpression(undefined, ast)).toBeNull();
  });

  it('returns non-Identifier expressions directly', () => {
    const ast = parse('42');
    const numLiteral = (ast.body[0] as E.ExpressionStatement).expression;
    expect(resolveExpression(numLiteral, ast)).toBe(numLiteral);
  });

  it('resolves a bare VariableDeclaration', () => {
    const ast = parse(`
      const foo = { a: 1 };
      export default foo;
    `);
    const result = resolveExpression(findExportDefault(ast)!.declaration, ast);
    expect(result?.type).toBe('ObjectExpression');
  });

  it('resolves an exported const (ExportNamedDeclaration)', () => {
    const ast = parse(`
      export const config = { a: 1 };
      export default config;
    `);
    const result = resolveExpression(findExportDefault(ast)!.declaration, ast);
    expect(result?.type).toBe('ObjectExpression');
  });

  it('resolves a chain of variable references', () => {
    const ast = parse(`
      const inner = { a: 1 };
      const outer = inner;
      export default outer;
    `);
    const result = resolveExpression(findExportDefault(ast)!.declaration, ast);
    expect(result?.type).toBe('ObjectExpression');
  });

  it('resolves through TSAsExpression', () => {
    const ast = parse(`
      const foo = { a: 1 };
      export default foo as any;
    `);
    const result = resolveExpression(findExportDefault(ast)!.declaration, ast);
    expect(result?.type).toBe('ObjectExpression');
  });

  it('resolves through TSSatisfiesExpression', () => {
    const ast = parse(`
      const foo = { a: 1 };
      export default foo satisfies object;
    `);
    const result = resolveExpression(findExportDefault(ast)!.declaration, ast);
    expect(result?.type).toBe('ObjectExpression');
  });

  it('returns the Identifier node when variable is not found', () => {
    const ast = parse(`export default unknown;`);
    const result = resolveExpression(findExportDefault(ast)!.declaration, ast);
    expect(result?.type).toBe('Identifier');
    expect(result).toMatchObject({ name: 'unknown' });
  });

  it('returns the Identifier node when variable has no initializer', () => {
    const ast = parse(`
      let foo;
      export default foo;
    `);
    const result = resolveExpression(findExportDefault(ast)!.declaration, ast);
    expect(result?.type).toBe('Identifier');
    expect(result).toMatchObject({ name: 'foo' });
  });

  it('returns null when maxDepth is exceeded', () => {
    const lines = Array.from({ length: 12 }, (_, i) =>
      i === 0 ? `const v0 = { a: 1 };` : `const v${i} = v${i - 1};`
    ).join('\n');
    const ast = parse(`${lines}\nexport default v11;`);
    const result = resolveExpression(findExportDefault(ast)!.declaration, ast);
    expect(result).toBeNull();
  });
});
