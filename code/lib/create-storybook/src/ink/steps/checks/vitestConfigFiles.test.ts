import { describe, expect, it, vi } from 'vitest';

import * as find from 'empathic/find';

import { vitestConfigFiles } from './vitestConfigFiles';

vi.mock('empathic/find', () => ({
  up: vi.fn(),
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

vi.mock(import('node:fs/promises'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    readFile: vi
      .fn()
      .mockImplementation((filePath) => fileMocks[filePath as keyof typeof fileMocks]),
  };
});

const mockContext: any = {};

const coerce = (from: string, to: string) => (name: string) => (name.includes(from) ? to : name);

const state: any = {
  directory: '.',
};

describe('vitestConfigFiles', () => {
  it('should run properly with mock dependencies', async () => {
    const result = await vitestConfigFiles.condition(mockContext, state);
    expect(result).toEqual({ type: 'compatible' });
  });

  it('should disallow missing dependencies', async () => {
    const result = await vitestConfigFiles.condition({} as any, state);
    expect(result).toEqual({
      type: 'incompatible',
      reasons: ['Missing babel on context', 'Missing empathic on context', 'Missing fs on context'],
    });
  });

  describe('Check Vitest workspace files', () => {
    it('should disallow JSON workspace file', async () => {
      vi.mocked(find.up).mockImplementation(coerce('workspace', 'vitest.workspace.json'));
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Cannot auto-update JSON workspace file: vitest.workspace.json'],
      });
    });

    it('should disallow invalid workspace file', async () => {
      vi.mocked(find.up).mockImplementation(coerce('workspace', 'invalidWorkspace.ts'));
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid workspace config file: invalidWorkspace.ts'],
      });
    });

    it('should allow defineWorkspace syntax', async () => {
      vi.mocked(find.up).mockImplementation(coerce('workspace', 'defineWorkspace.ts'));
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'compatible',
      });
    });

    it('should disallow invalid defineWorkspace syntax', async () => {
      vi.mocked(find.up).mockImplementation(coerce('workspace', 'defineWorkspace-invalid.ts'));
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid workspace config file: defineWorkspace-invalid.ts'],
      });
    });
  });

  describe('Check Vitest config files', () => {
    it('should disallow CommonJS config file', async () => {
      vi.mocked(find.up).mockImplementation(coerce('config', 'vitest.config.cjs'));
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Cannot auto-update CommonJS config file: vitest.config.cjs'],
      });
    });

    it('should disallow invalid config file', async () => {
      vi.mocked(find.up).mockImplementation(coerce('config', 'invalidConfig.ts'));
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid Vitest config file: invalidConfig.ts'],
      });
    });

    it('should allow existing test config option', async () => {
      vi.mocked(find.up).mockImplementation(coerce('config', 'testConfig.ts'));
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'compatible',
      });
    });

    it('should disallow invalid test config option', async () => {
      vi.mocked(find.up).mockImplementation(coerce('config', 'testConfig-invalid.ts'));
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid Vitest config file: testConfig-invalid.ts'],
      });
    });

    it('should allow existing test.workspace config option', async () => {
      vi.mocked(find.up).mockImplementation(coerce('config', 'workspaceConfig.ts'));
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'compatible',
      });
    });

    it('should disallow invalid test.workspace config option', async () => {
      vi.mocked(find.up).mockImplementation(coerce('config', 'workspaceConfig-invalid.ts'));
      const result = await vitestConfigFiles.condition(mockContext, state);
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid Vitest config file: workspaceConfig-invalid.ts'],
      });
    });
  });
});
