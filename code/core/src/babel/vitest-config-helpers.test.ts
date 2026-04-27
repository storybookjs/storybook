import { describe, expect, it } from 'vitest';

import {
  canUpdateVitestConfigFile,
  canUpdateVitestWorkspaceFile,
} from './vitest-config-helpers.ts';

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

  // ----- Unsupported patterns (should return false) -----

  it('returns false when there is no export default', () => {
    expect(canUpdateVitestConfigFile('const x = 1;')).toBe(false);
  });

  it('returns false for arrow function pattern: defineConfig(() => ({}))', () => {
    expect(
      canUpdateVitestConfigFile(
        `
        import { defineConfig } from 'vitest/config';
        export default defineConfig(() => ({ test: {} }))
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

// ─── canUpdateVitestWorkspaceFile ────────────────────────────────────────────

describe('canUpdateVitestWorkspaceFile', () => {
  // ----- Supported patterns (should return true) -----

  it('returns true for plain array workspace', () => {
    expect(canUpdateVitestWorkspaceFile('export default ["project1", "project2"]')).toBe(true);
  });

  it('returns true for array with object entries', () => {
    expect(canUpdateVitestWorkspaceFile('export default [{ test: {} }, "project"]')).toBe(true);
  });

  it('returns true for empty array', () => {
    expect(canUpdateVitestWorkspaceFile('export default []')).toBe(true);
  });

  it('returns true for defineWorkspace([...]) pattern', () => {
    expect(
      canUpdateVitestWorkspaceFile(
        `
        import { defineWorkspace } from 'vitest/config';
        export default defineWorkspace(['project1', 'project2'])
        `
      )
    ).toBe(true);
  });

  it('returns true for defineWorkspace with object entries', () => {
    expect(
      canUpdateVitestWorkspaceFile(
        `
        import { defineWorkspace } from 'vitest/config';
        export default defineWorkspace([{ test: { name: 'unit' } }])
        `
      )
    ).toBe(true);
  });

  // ----- Unsupported patterns (should return false) -----

  it('returns false when there is no export default', () => {
    expect(canUpdateVitestWorkspaceFile('const projects = ["a"];')).toBe(false);
  });

  it('returns false for defineWorkspace with a non-array argument', () => {
    expect(
      canUpdateVitestWorkspaceFile(
        `
        import { defineWorkspace } from 'vitest/config';
        export default defineWorkspace('glob/**')
        `
      )
    ).toBe(false);
  });

  it('returns false for syntax errors', () => {
    expect(canUpdateVitestWorkspaceFile('this is not valid syntax !!!')).toBe(false);
  });
});
