import * as fs from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { findUp } from 'find-up';

import * as babel from '../../../../../../core/src/babel';
import { vitestConfigFiles } from './vitestConfigFiles';

const liveContext: any = { babel, findUp, fs };

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

const mockContext: any = {
  ...liveContext,
  findUp: async ([name]: string[]) => name,
  fs: {
    readFile: async (path: keyof typeof fileMocks) => fileMocks[path],
  },
};

const coerce =
  (from: string, to: string) =>
  async ([name]: string[]) =>
    name.includes(from) ? to : name;

const state: any = {
  directory: '.',
};

// TODO @ghengeveld, I am in the process of removing the context
describe.skip('these tests need to be updated', () => {
  it('should run properly with live dependencies', async () => {
    const result = await vitestConfigFiles.condition(liveContext, state);
    expect(result).toEqual({ type: 'compatible' });
  });

  it('should run properly with mock dependencies', async () => {
    const result = await vitestConfigFiles.condition(mockContext, state);
    expect(result).toEqual({ type: 'compatible' });
  });

  it('should disallow missing dependencies', async () => {
    const result = await vitestConfigFiles.condition({} as any, state);
    expect(result).toEqual({
      type: 'incompatible',
      reasons: ['Missing babel on context', 'Missing findUp on context', 'Missing fs on context'],
    });
  });

  describe('Check Vitest workspace files', () => {
    it('should disallow JSON workspace file', async () => {
      const result = await vitestConfigFiles.condition(
        { ...mockContext, findUp: coerce('workspace', 'vitest.workspace.json') },
        state
      );
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Cannot auto-update JSON workspace file: vitest.workspace.json'],
      });
    });

    it('should disallow invalid workspace file', async () => {
      const result = await vitestConfigFiles.condition(
        { ...mockContext, findUp: coerce('workspace', 'invalidWorkspace.ts') },
        state
      );
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid workspace config file: invalidWorkspace.ts'],
      });
    });

    it('should allow defineWorkspace syntax', async () => {
      const result = await vitestConfigFiles.condition(
        { ...mockContext, findUp: coerce('workspace', 'defineWorkspace.ts') },
        state
      );
      expect(result).toEqual({
        type: 'compatible',
      });
    });

    it('should disallow invalid defineWorkspace syntax', async () => {
      const result = await vitestConfigFiles.condition(
        { ...mockContext, findUp: coerce('workspace', 'defineWorkspace-invalid.ts') },
        state
      );
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid workspace config file: defineWorkspace-invalid.ts'],
      });
    });
  });

  describe('Check Vitest config files', () => {
    it('should disallow CommonJS config file', async () => {
      const result = await vitestConfigFiles.condition(
        { ...mockContext, findUp: coerce('config', 'vitest.config.cjs') },
        state
      );
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Cannot auto-update CommonJS config file: vitest.config.cjs'],
      });
    });

    it('should disallow invalid config file', async () => {
      const result = await vitestConfigFiles.condition(
        { ...mockContext, findUp: coerce('config', 'invalidConfig.ts') },
        state
      );
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid Vitest config file: invalidConfig.ts'],
      });
    });

    it('should allow existing test config option', async () => {
      const result = await vitestConfigFiles.condition(
        { ...mockContext, findUp: coerce('config', 'testConfig.ts') },
        state
      );
      expect(result).toEqual({
        type: 'compatible',
      });
    });

    it('should disallow invalid test config option', async () => {
      const result = await vitestConfigFiles.condition(
        { ...mockContext, findUp: coerce('config', 'testConfig-invalid.ts') },
        state
      );
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid Vitest config file: testConfig-invalid.ts'],
      });
    });

    it('should allow existing test.workspace config option', async () => {
      const result = await vitestConfigFiles.condition(
        { ...mockContext, findUp: coerce('config', 'workspaceConfig.ts') },
        state
      );
      expect(result).toEqual({
        type: 'compatible',
      });
    });

    it('should disallow invalid test.workspace config option', async () => {
      const result = await vitestConfigFiles.condition(
        { ...mockContext, findUp: coerce('config', 'workspaceConfig-invalid.ts') },
        state
      );
      expect(result).toEqual({
        type: 'incompatible',
        reasons: ['Found an invalid Vitest config file: workspaceConfig-invalid.ts'],
      });
    });
  });
});
