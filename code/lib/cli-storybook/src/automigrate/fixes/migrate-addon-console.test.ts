import { readFileSync, writeFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAddonNames, removeAddon } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import dedent from 'ts-dedent';

import type { RunOptions } from '../types';
import {
  type MigrateAddonConsoleOptions,
  migrateAddonConsole,
  transformPreviewFile,
} from './migrate-addon-console';

// Mock external dependencies
vi.mock('storybook/internal/common', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    getAddonNames: vi.fn(),
    removeAddon: vi.fn(),
  };
});

vi.mock('storybook/internal/node-logger', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    logger: {
      debug: vi.fn(),
    },
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

const loggerMock = vi.mocked(logger);

describe('migrateAddonConsole', () => {
  const configDir = '.storybook';
  const mainConfig = {} as any;
  const previewConfigPath = '.storybook/preview.ts';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('check', () => {
    it('should return null if console addon is not present in config or dependencies', async () => {
      vi.mocked(getAddonNames).mockReturnValue([]);
      const packageManager = {
        isDependencyInstalled: vi.fn().mockReturnValue(false),
      } as any;

      const result = await migrateAddonConsole.check({
        mainConfig,
        packageManager,
        previewConfigPath,
      } as RunOptions<MigrateAddonConsoleOptions>);

      expect(result).toBeNull();
      expect(packageManager.isDependencyInstalled).toHaveBeenCalledWith('@storybook/addon-console');
    });

    it('should return result if console addon is present in config', async () => {
      vi.mocked(getAddonNames).mockReturnValue(['@storybook/addon-console']);
      const packageManager = {
        isDependencyInstalled: vi.fn().mockReturnValue(false),
      } as any;
      vi.mocked(readFileSync).mockReturnValue('export default {};');

      const result = await migrateAddonConsole.check({
        mainConfig,
        packageManager,
        previewConfigPath,
      } as RunOptions<MigrateAddonConsoleOptions>);

      expect(result).toEqual({
        transformedPreviewCode: expect.any(String),
      });
    });

    it('should return result if console addon is present in dependencies', async () => {
      vi.mocked(getAddonNames).mockReturnValue([]);
      const packageManager = {
        isDependencyInstalled: vi.fn().mockReturnValue(true),
      } as any;
      vi.mocked(readFileSync).mockReturnValue('export default {};');

      const result = await migrateAddonConsole.check({
        mainConfig,
        packageManager,
        previewConfigPath,
      } as RunOptions<MigrateAddonConsoleOptions>);

      expect(result).toEqual({
        transformedPreviewCode: expect.any(String),
      });
    });

    it('should return result with undefined transformedPreviewCode if no preview config path', async () => {
      vi.mocked(getAddonNames).mockReturnValue(['@storybook/addon-console']);
      const packageManager = {
        isDependencyInstalled: vi.fn().mockReturnValue(false),
      } as any;

      const result = await migrateAddonConsole.check({
        mainConfig,
        packageManager,
        previewConfigPath: undefined,
      } as RunOptions<MigrateAddonConsoleOptions>);

      expect(result).toEqual({
        previewConfigPath: undefined,
        transformedPreviewCode: undefined,
      });
    });
  });

  describe('prompt', () => {
    it('should return the correct prompt message', () => {
      const message = migrateAddonConsole.prompt();
      expect(message).toBe(
        '@storybook/addon-console can now be implemented with spies on the console object.'
      );
    });
  });

  describe('run', () => {
    const packageManager = {} as any;

    it('should not write files when in dry run mode', async () => {
      await migrateAddonConsole.run?.({
        packageManager,
        dryRun: true,
        configDir,
        result: {
          transformedPreviewCode: 'transformed code',
        },
      } as RunOptions<MigrateAddonConsoleOptions>);

      expect(writeFileSync).not.toHaveBeenCalled();
      expect(removeAddon).not.toHaveBeenCalled();
    });

    it('should remove addon and update preview file when not in dry run mode', async () => {
      const transformedPreviewCode = 'transformed code';

      await migrateAddonConsole.run?.({
        packageManager,
        dryRun: false,
        configDir,
        result: {
          transformedPreviewCode,
        },
      } as RunOptions<MigrateAddonConsoleOptions>);

      expect(writeFileSync).toHaveBeenCalledWith(previewConfigPath, transformedPreviewCode, 'utf8');
      expect(removeAddon).toHaveBeenCalledWith('@storybook/addon-console', {
        configDir,
        skipInstall: true,
        packageManager,
      });
      expect(loggerMock.debug).toHaveBeenCalledWith(
        'Updating preview file to replace addon-console logic with spies.'
      );
      expect(loggerMock.debug).toHaveBeenCalledWith('Removing @storybook/addon-console addon.');
    });

    it("should remove addon and create a preview file when it didn't previously exist", async () => {
      await migrateAddonConsole.run?.({
        packageManager,
        dryRun: false,
        configDir,
        previewConfigPath: undefined,
        result: {
          transformedPreviewCode: undefined,
        },
      } as RunOptions<MigrateAddonConsoleOptions>);

      expect(removeAddon).toHaveBeenCalledWith('@storybook/addon-console', {
        configDir,
        skipInstall: true,
        packageManager,
      });
      expect(writeFileSync).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'utf8');
      expect(loggerMock.debug).toHaveBeenCalledWith(
        'addon-console was installed but no preview file was found. Creating a preview file.'
      );
      expect(loggerMock.debug).toHaveBeenCalledWith('Removing @storybook/addon-console addon.');
    });
  });
});

describe('transformPreviewFile', () => {
  it('should add spyOn import and remove addon-console import', async () => {
    const source = dedent`
      import "@storybook/addon-console";
      
      export default {};
    `;

    const target = dedent`
    import { spyOn } from 'storybook/test';

    export default {
      beforeEach: function beforeEach() {
        spyOn(console, 'log').mockName('console.log');
        spyOn(console, 'warn').mockName('console.warn');
        spyOn(console, 'error').mockName('console.error');
        spyOn(console, 'info').mockName('console.info');
        spyOn(console, 'debug').mockName('console.debug');
        spyOn(console, 'trace').mockName('console.trace');
        spyOn(console, 'count').mockName('console.count');
        spyOn(console, 'dir').mockName('console.dir');
        spyOn(console, 'assert').mockName('console.assert');
      },
    };

`;

    const result = await transformPreviewFile(source, '.storybook/preview.ts');
    expect(result).toBe(target);
  });

  it('should add console spies to beforeEach function', async () => {
    const source = dedent`
      import "@storybook/addon-console";
      
      export default {
        beforeEach: () => {
          // existing code
        }
      };
    `;

    const target = dedent`
    import { spyOn } from 'storybook/test';
    
    export default {
      beforeEach: () => {
        spyOn(console, 'log').mockName('console.log');
        spyOn(console, 'warn').mockName('console.warn');
        spyOn(console, 'error').mockName('console.error');
        spyOn(console, 'info').mockName('console.info');
        spyOn(console, 'debug').mockName('console.debug');
        spyOn(console, 'trace').mockName('console.trace');
        spyOn(console, 'count').mockName('console.count');
        spyOn(console, 'dir').mockName('console.dir');
        spyOn(console, 'assert').mockName('console.assert');
      },
    };

    `;

    const result = await transformPreviewFile(source, '.storybook/preview.ts');
    expect(result).toBe(target);
  });

  it('should create beforeEach function if it does not exist', async () => {
    const source = dedent`
      import "@storybook/addon-console";
      
      export default {};
    `;

    const target = dedent`
    import { spyOn } from 'storybook/test';

    export default {
      beforeEach: function beforeEach() {
        spyOn(console, 'log').mockName('console.log');
        spyOn(console, 'warn').mockName('console.warn');
        spyOn(console, 'error').mockName('console.error');
        spyOn(console, 'info').mockName('console.info');
        spyOn(console, 'debug').mockName('console.debug');
        spyOn(console, 'trace').mockName('console.trace');
        spyOn(console, 'count').mockName('console.count');
        spyOn(console, 'dir').mockName('console.dir');
        spyOn(console, 'assert').mockName('console.assert');
      },
    };

`;

    const result = await transformPreviewFile(source, '.storybook/preview.ts');
    expect(result).toBe(target);
  });

  it('should handle arrow function beforeEach with expression body', async () => {
    const source = dedent`
      import "@storybook/addon-console";
      
      export default {
        beforeEach: () => someFunction()
      };
    `;

    const target = dedent`
      import { spyOn } from 'storybook/test';

      export default {
        beforeEach: () => {
          spyOn(console, 'log').mockName('console.log');
          spyOn(console, 'warn').mockName('console.warn');
          spyOn(console, 'error').mockName('console.error');
          spyOn(console, 'info').mockName('console.info');
          spyOn(console, 'debug').mockName('console.debug');
          spyOn(console, 'trace').mockName('console.trace');
          spyOn(console, 'count').mockName('console.count');
          spyOn(console, 'dir').mockName('console.dir');
          spyOn(console, 'assert').mockName('console.assert');
          return someFunction();
        },
      };

    `;

    const result = await transformPreviewFile(source, '.storybook/preview.ts');
    expect(result).toBe(target);
  });

  it('should handle arrow function beforeEach with block body', async () => {
    const source = dedent`
      import "@storybook/addon-console";
      
      export default {
        beforeEach: () => {
          // existing setup
          setupTest();
        }
      };
    `;

    const target = dedent`
    import { spyOn } from 'storybook/test';

    export default {
      beforeEach: () => {
        // existing setup
        setupTest();
        spyOn(console, 'log').mockName('console.log');
        spyOn(console, 'warn').mockName('console.warn');
        spyOn(console, 'error').mockName('console.error');
        spyOn(console, 'info').mockName('console.info');
        spyOn(console, 'debug').mockName('console.debug');
        spyOn(console, 'trace').mockName('console.trace');
        spyOn(console, 'count').mockName('console.count');
        spyOn(console, 'dir').mockName('console.dir');
        spyOn(console, 'assert').mockName('console.assert');
      },
    };

`;

    const result = await transformPreviewFile(source, '.storybook/preview.ts');
    expect(result).toBe(target);
  });

  it('should handle beforeEach function', async () => {
    const source = dedent`
      import "@storybook/addon-console";
      
      export default {
        beforeEach: function() {
          // existing code
          setupSomething();
        }
      };
    `;

    const target = dedent`
    import { spyOn } from 'storybook/test';

    export default {
      beforeEach: function () {
        // existing code
        setupSomething();
        spyOn(console, 'log').mockName('console.log');
        spyOn(console, 'warn').mockName('console.warn');
        spyOn(console, 'error').mockName('console.error');
        spyOn(console, 'info').mockName('console.info');
        spyOn(console, 'debug').mockName('console.debug');
        spyOn(console, 'trace').mockName('console.trace');
        spyOn(console, 'count').mockName('console.count');
        spyOn(console, 'dir').mockName('console.dir');
        spyOn(console, 'assert').mockName('console.assert');
      },
    };

`;

    const result = await transformPreviewFile(source, '.storybook/preview.ts');
    expect(result).toBe(target);
  });

  it('should handle existing beforeEach function declaration', async () => {
    const source = dedent`
      import "@storybook/addon-console";
      
      export default {
        beforeEach: function beforeEach() {
          // existing setup
          initializeTest();
        }
      };
    `;

    const target = dedent`
    import { spyOn } from 'storybook/test';

    export default {
      beforeEach: function beforeEach() {
        // existing setup
        initializeTest();
        spyOn(console, 'log').mockName('console.log');
        spyOn(console, 'warn').mockName('console.warn');
        spyOn(console, 'error').mockName('console.error');
        spyOn(console, 'info').mockName('console.info');
        spyOn(console, 'debug').mockName('console.debug');
        spyOn(console, 'trace').mockName('console.trace');
        spyOn(console, 'count').mockName('console.count');
        spyOn(console, 'dir').mockName('console.dir');
        spyOn(console, 'assert').mockName('console.assert');
      },
    };

`;

    const result = await transformPreviewFile(source, '.storybook/preview.ts');
    expect(result).toBe(target);
  });

  it('should preserve existing spyOn import if present', async () => {
    const source = dedent`
      import { spyOn } from "storybook/test";
      import "@storybook/addon-console";
      
      export default {};
    `;

    const target = dedent`
    import { spyOn } from 'storybook/test';

    export default {
      beforeEach: function beforeEach() {
        spyOn(console, 'log').mockName('console.log');
        spyOn(console, 'warn').mockName('console.warn');
        spyOn(console, 'error').mockName('console.error');
        spyOn(console, 'info').mockName('console.info');
        spyOn(console, 'debug').mockName('console.debug');
        spyOn(console, 'trace').mockName('console.trace');
        spyOn(console, 'count').mockName('console.count');
        spyOn(console, 'dir').mockName('console.dir');
        spyOn(console, 'assert').mockName('console.assert');
      },
    };

`;

    const result = await transformPreviewFile(source, '.storybook/preview.ts');
    expect(result).toBe(target);
  });

  it('should create named export for beforeEach when no default export exists', async () => {
    const source = dedent`
      import "@storybook/addon-console";
      
      export const parameters = {};
    `;

    const target = dedent`
    import { spyOn } from 'storybook/test';

    export const parameters = {};

    export const beforeEach = function beforeEach() {
      spyOn(console, 'log').mockName('console.log');
      spyOn(console, 'warn').mockName('console.warn');
      spyOn(console, 'error').mockName('console.error');
      spyOn(console, 'info').mockName('console.info');
      spyOn(console, 'debug').mockName('console.debug');
      spyOn(console, 'trace').mockName('console.trace');
      spyOn(console, 'count').mockName('console.count');
      spyOn(console, 'dir').mockName('console.dir');
      spyOn(console, 'assert').mockName('console.assert');
    };

`;

    const result = await transformPreviewFile(source, '.storybook/preview.ts');
    expect(result).toBe(target);
  });

  it('should add beforeEach to default export object when no beforeEach exists', async () => {
    const source = dedent`
      import "@storybook/addon-console";
      
      export default {
        parameters: {
          layout: 'centered'
        }
      };
    `;

    const target = dedent`
    import { spyOn } from 'storybook/test';

    export default {
      parameters: {
        layout: 'centered',
      },

      beforeEach: function beforeEach() {
        spyOn(console, 'log').mockName('console.log');
        spyOn(console, 'warn').mockName('console.warn');
        spyOn(console, 'error').mockName('console.error');
        spyOn(console, 'info').mockName('console.info');
        spyOn(console, 'debug').mockName('console.debug');
        spyOn(console, 'trace').mockName('console.trace');
        spyOn(console, 'count').mockName('console.count');
        spyOn(console, 'dir').mockName('console.dir');
        spyOn(console, 'assert').mockName('console.assert');
      },
    };

    `;

    const result = await transformPreviewFile(source, '.storybook/preview.ts');
    expect(result).toBe(target);
  });
});
