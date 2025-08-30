import { describe, expect, it, vi } from 'vitest';

import * as babel from 'storybook/internal/babel';

import { findUp } from 'find-up';

import { vitestConfigFiles } from './vitestConfigFiles';

vi.mock('find-up', () => ({
  findUp: vi.fn().mockImplementation(([name]) => name),
  findUpSync: vi.fn(),
}));

const fileMocks = {
  'vitest.config.ts': `
    import { defineConfig } from 'vitest/config'
    export default defineConfig({})
  `,
  'invalidConfig.ts': `
    import { defineConfig } from 'vitest/config'
    export default defineConfig(['packages/*'])
  `,
  'testConfig.ts': `
    import { defineConfig } from 'vitest/config'
    export default defineConfig({
      test: {
        coverage: {
          provider: 'istanbul'
        },
      },
    })
  `,
  'testConfig-invalid.ts': `
    import { defineConfig } from 'vitest/config'
    export default defineConfig({
      test: true,
    })
  `,
  'workspaceConfig.ts': `
    import { defineConfig } from 'vitest/config'
    export default defineConfig({
      test: {
        workspace: ['packages/*'],
      },
    })
  `,
  'workspaceConfig-invalid.ts': `
    import { defineConfig } from 'vitest/config'
    export default defineConfig({
      test: {
        workspace: { "test": "packages/*" },
      },
    })
  `,
  'vitest.workspace.json': `
    ["packages/*"]
  `,
  'vitest.workspace.ts': `
    export default ['packages/*']
  `,
  'invalidWorkspace.ts': `
    export default { "test": "packages/*" }
  `,
  'defineWorkspace.ts': `
    import { defineWorkspace } from 'vitest/config'
    export default defineWorkspace(['packages/*'])
  `,
  'defineWorkspace-invalid.ts': `
    import { defineWorkspace } from 'vitest/config'
    export default defineWorkspace({ "test": "packages/*" })
  `,
};

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockImplementation((filePath) => fileMocks[filePath as keyof typeof fileMocks]),
}));

const mockContext: any = {};

const coerce =
  (from: string, to: string) =>
  async ([name]: string[]) =>
    name.includes(from) ? to : name;

const state: any = {
  directory: '.',
};

describe('vitestConfigFiles', () => {
  it('should run properly with mock dependencies', async () => {
    const result = await vitestConfigFiles.condition(mockContext, state);
    expect(result).toEqual({ type: 'compatible' });
  });

  describe('Check Vitest workspace files', () => {
    it('should disallow JSON workspace file', async () => {
      vi.mocked(findUp).mockImplementation(coerce('workspace', 'vitest.workspace.json') as never);
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Cannot auto-update JSON workspace file: vitest.workspace.json'],
      });
    });

    it('should disallow invalid workspace file', async () => {
      vi.mocked(findUp).mockImplementation(coerce('workspace', 'invalidWorkspace.ts') as never);
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid workspace config file: invalidWorkspace.ts'],
      });
    });

    it('should allow defineWorkspace syntax', async () => {
      vi.mocked(findUp).mockImplementation(coerce('workspace', 'defineWorkspace.ts') as never);
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'compatible',
      });
    });

    it('should disallow invalid defineWorkspace syntax', async () => {
      vi.mocked(findUp).mockImplementation(
        coerce('workspace', 'defineWorkspace-invalid.ts') as never
      );
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid workspace config file: defineWorkspace-invalid.ts'],
      });
    });
  });

  describe('Check Vitest config files', () => {
    it('should disallow CommonJS config file', async () => {
      vi.mocked(findUp).mockImplementation(coerce('config', 'vitest.config.cjs') as never);
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Cannot auto-update CommonJS config file: vitest.config.cjs'],
      });
    });

    it('should disallow invalid config file', async () => {
      vi.mocked(findUp).mockImplementation(coerce('config', 'invalidConfig.ts') as never);
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid Vitest config file: invalidConfig.ts'],
      });
    });

    it('should allow existing test config option', async () => {
      vi.mocked(findUp).mockImplementation(coerce('config', 'testConfig.ts') as never);
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'compatible',
      });
    });

    it('should disallow invalid test config option', async () => {
      vi.mocked(findUp).mockImplementation(coerce('config', 'testConfig-invalid.ts') as never);
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid Vitest config file: testConfig-invalid.ts'],
      });
    });

    it('should allow existing test.workspace config option', async () => {
      vi.mocked(findUp).mockImplementation(coerce('config', 'workspaceConfig.ts') as never);
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'compatible',
      });
    });

    it('should disallow invalid test.workspace config option', async () => {
      vi.mocked(findUp).mockImplementation(coerce('config', 'workspaceConfig-invalid.ts') as never);
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid Vitest config file: workspaceConfig-invalid.ts'],
      });
    });
  });
});
