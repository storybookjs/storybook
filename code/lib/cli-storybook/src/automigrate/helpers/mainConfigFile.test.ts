import { describe, expect, it } from 'vitest';

import {
  containsDirnameUsage,
  containsPatternUsage,
  getBuilderPackageName,
  getFrameworkPackageName,
  getRendererName,
  getRendererPackageNameFromFramework,
  hasDirnameDefined,
} from './mainConfigFile';

describe('getBuilderPackageName', () => {
  it('should return null when mainConfig is undefined or null', () => {
    const packageName = getBuilderPackageName(undefined);
    expect(packageName).toBeNull();

    // @ts-expect-error (Argument of type 'null' is not assignable)
    const packageName2 = getBuilderPackageName(null);
    expect(packageName2).toBeNull();
  });

  it('should return null when builder package name or path is not found', () => {
    const mainConfig = {};

    const packageName = getBuilderPackageName(mainConfig as any);
    expect(packageName).toBeNull();
  });

  it('should return builder package name when core.builder is a string', () => {
    const builderPackage = '@storybook/builder-webpack5';
    const mainConfig = {
      core: {
        builder: builderPackage,
      },
    };

    const packageName = getBuilderPackageName(mainConfig as any);
    expect(packageName).toBe(builderPackage);
  });

  it('should return builder package name when core.builder.name contains valid builder package name', () => {
    const builderPackage = '@storybook/builder-webpack5';
    const packageNameOrPath = `/path/to/${builderPackage}`;
    const mainConfig = {
      core: {
        builder: { name: packageNameOrPath },
      },
    };

    const packageName = getBuilderPackageName(mainConfig as any);
    expect(packageName).toBe(builderPackage);
  });

  it('should return builder package name when core.builder.name contains windows backslash paths', () => {
    const builderPackage = '@storybook/builder-webpack5';
    const packageNameOrPath = 'c:\\path\\to\\@storybook\\builder-webpack5';
    const mainConfig = {
      core: {
        builder: { name: packageNameOrPath },
      },
    };

    const packageName = getBuilderPackageName(mainConfig as any);
    expect(packageName).toBe(builderPackage);
  });

  it(`should return package name or path when core.builder doesn't contain the name of a valid builder package`, () => {
    const packageNameOrPath = '@my-org/storybook-builder';
    const mainConfig = {
      core: {
        builder: packageNameOrPath,
      },
    };

    const packageName = getBuilderPackageName(mainConfig as any);
    expect(packageName).toBe(packageNameOrPath);
  });
});

describe('getFrameworkPackageName', () => {
  it('should return null when mainConfig is undefined or null', () => {
    const packageName = getFrameworkPackageName(undefined);
    expect(packageName).toBeNull();

    // @ts-expect-error (Argument of type 'null' is not assignable)
    const packageName2 = getFrameworkPackageName(null);
    expect(packageName2).toBeNull();
  });

  it('should return null when framework package name or path is not found', () => {
    const mainConfig = {};

    const packageName = getFrameworkPackageName(mainConfig as any);
    expect(packageName).toBeNull();
  });

  it('should return framework package name when framework is a string', () => {
    const frameworkPackage = '@storybook/react';
    const mainConfig = {
      framework: frameworkPackage,
    };

    const packageName = getFrameworkPackageName(mainConfig as any);
    expect(packageName).toBe(frameworkPackage);
  });

  it('should return framework package name when framework.name contains valid framework package name', () => {
    const frameworkPackage = '@storybook/react-vite';
    const packageNameOrPath = `/path/to/${frameworkPackage}`;
    const mainConfig = {
      framework: { name: packageNameOrPath },
    };

    const packageName = getFrameworkPackageName(mainConfig as any);
    expect(packageName).toBe(frameworkPackage);
  });

  it('should return builder package name when framework.name contains windows backslash paths', () => {
    const builderPackage = '@storybook/react-vite';
    const packageNameOrPath = 'c:\\path\\to\\@storybook\\react-vite';
    const mainConfig = {
      framework: { name: packageNameOrPath },
    };

    const packageName = getFrameworkPackageName(mainConfig as any);
    expect(packageName).toBe(builderPackage);
  });

  it(`should return package name or path when framework does not contain the name of a valid framework package`, () => {
    const packageNameOrPath = '@my-org/storybook-framework';
    const mainConfig = {
      framework: packageNameOrPath,
    };

    const packageName = getFrameworkPackageName(mainConfig as any);
    expect(packageName).toBe(packageNameOrPath);
  });
});

describe('getRendererName', () => {
  it('should return null when mainConfig is undefined', () => {
    const rendererName = getRendererName(undefined);
    expect(rendererName).toBeNull();
  });

  it('should return null when framework package name or path is not found', () => {
    const mainConfig = {};

    const rendererName = getRendererName(mainConfig as any);
    expect(rendererName).toBeNull();
  });

  it('should return renderer name when framework is a string', () => {
    const frameworkPackage = '@storybook/react-webpack5';
    const mainConfig = {
      framework: frameworkPackage,
    };

    const rendererName = getRendererName(mainConfig as any);
    expect(rendererName).toBe('react');
  });

  it('should return renderer name when framework.name contains valid framework package name', () => {
    const frameworkPackage = '@storybook/react-vite';
    const packageNameOrPath = `/path/to/${frameworkPackage}`;
    const mainConfig = {
      framework: { name: packageNameOrPath },
    };

    const rendererName = getRendererName(mainConfig as any);
    expect(rendererName).toBe('react');
  });

  it('should return renderer name when framework.name contains windows backslash paths', () => {
    const packageNameOrPath = 'c:\\path\\to\\@storybook\\sveltekit';
    const mainConfig = {
      framework: { name: packageNameOrPath },
    };

    const rendererName = getRendererName(mainConfig as any);
    expect(rendererName).toBe('svelte');
  });

  it(`should return undefined when framework does not contain the name of a valid framework package`, () => {
    const packageNameOrPath = '@my-org/storybook-framework';
    const mainConfig = {
      framework: packageNameOrPath,
    };

    const rendererName = getRendererName(mainConfig as any);
    expect(rendererName).toBeUndefined();
  });
});

describe('getRendererPackageNameFromFramework', () => {
  it('should return null when given no package name', () => {
    // @ts-expect-error (Argument of type 'undefined' is not assignable)
    const packageName = getRendererPackageNameFromFramework(undefined);
    expect(packageName).toBeNull();
  });

  it('should return the frameworkPackageName if it exists in rendererPackages', () => {
    const frameworkPackageName = '@storybook/angular';
    const packageName = getRendererPackageNameFromFramework(frameworkPackageName);
    expect(packageName).toBe(frameworkPackageName);
  });

  it('should return the corresponding key of rendererPackages if the value is the same as the frameworkPackageName', () => {
    const frameworkPackageName = 'vue3';
    const expectedPackageName = '@storybook/vue3';
    const packageName = getRendererPackageNameFromFramework(frameworkPackageName);
    expect(packageName).toBe(expectedPackageName);
  });

  it('should return null if a frameworkPackageName is known but not available in rendererPackages', () => {
    const frameworkPackageName = '@storybook/unknown';
    const packageName = getRendererPackageNameFromFramework(frameworkPackageName);
    expect(packageName).toBeNull();
  });
});

describe('containsPatternUsage', () => {
  it('should detect __dirname usage with hardcoded regex', () => {
    const content = `
      const path = require('path');
      const configPath = path.join(__dirname, 'config.js');
    `;
    expect(containsPatternUsage(content, /\b__dirname\b/)).toBe(true);
  });

  it('should not detect __dirname in comments', () => {
    const content = `
      // This is __dirname in a comment
      const path = require('path');
    `;
    expect(containsPatternUsage(content, /\b__dirname\b/)).toBe(false);
  });

  it('should not detect __dirname in strings', () => {
    const content = `
      const message = "This is __dirname in a string";
      const path = require('path');
    `;
    expect(containsPatternUsage(content, /\b__dirname\b/)).toBe(false);
  });

  it('should return false when __dirname is not used', () => {
    const content = `
      const path = require('path');
      const configPath = path.join(process.cwd(), 'config.js');
    `;
    expect(containsPatternUsage(content, /\b__dirname\b/)).toBe(false);
  });

  it('should work with other regex patterns', () => {
    const content = `
      const path = require('path');
      const configPath = path.join(__filename, 'config.js');
    `;
    expect(containsPatternUsage(content, /\b__filename\b/)).toBe(true);
    expect(containsPatternUsage(content, /\b__dirname\b/)).toBe(false);
  });
});

describe('containsDirnameUsage', () => {
  it('should detect __dirname usage', () => {
    const content = `
      const path = require('path');
      const configPath = path.join(__dirname, 'config.js');
    `;
    expect(containsDirnameUsage(content)).toBe(true);
  });

  it('should not detect __dirname in comments', () => {
    const content = `
      // This is __dirname in a comment
      const path = require('path');
    `;
    expect(containsDirnameUsage(content)).toBe(false);
  });

  it('should not detect __dirname in strings', () => {
    const content = `
      const message = "This is __dirname in a string";
      const path = require('path');
    `;
    expect(containsDirnameUsage(content)).toBe(false);
  });

  it('should return false when __dirname is not used', () => {
    const content = `
      const path = require('path');
      const configPath = path.join(process.cwd(), 'config.js');
    `;
    expect(containsDirnameUsage(content)).toBe(false);
  });
});

describe('hasDirnameDefined', () => {
  it('should detect const __dirname definition', () => {
    const content = `
      const __dirname = dirname(__filename);
      const path = require('path');
    `;
    expect(hasDirnameDefined(content)).toBe(true);
  });

  it('should detect let __dirname definition', () => {
    const content = `
      let __dirname = dirname(__filename);
      const path = require('path');
    `;
    expect(hasDirnameDefined(content)).toBe(true);
  });

  it('should detect var __dirname definition', () => {
    const content = `
      var __dirname = dirname(__filename);
      const path = require('path');
    `;
    expect(hasDirnameDefined(content)).toBe(true);
  });

  it('should return false when __dirname is not defined', () => {
    const content = `
      const path = require('path');
      const configPath = path.join(__dirname, 'config.js');
    `;
    expect(hasDirnameDefined(content)).toBe(false);
  });
});
