import { describe, expect, it } from 'vitest';

import {
  getBuilderPackageName,
  getFrameworkPackageName,
  getRendererName,
  getRendererPackageNameFromFramework,
  hasCreateRequireImport,
  hasRequireDefinition,
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

describe('hasCreateRequireImport', () => {
  it('should return true when file imports createRequire from module', () => {
    const content = `import { createRequire } from 'module';`;
    expect(hasCreateRequireImport(content)).toBe(true);
  });

  it('should return true when file imports createRequire from node:module', () => {
    const content = `import { createRequire } from "node:module";`;
    expect(hasCreateRequireImport(content)).toBe(true);
  });

  it('should return true when file imports createRequire with other imports', () => {
    const content = `import { createRequire, other } from 'module';`;
    expect(hasCreateRequireImport(content)).toBe(true);
  });

  it('should return true when file has createRequire in multiline import', () => {
    const content = `
      import {
        createRequire,
        other
      } from 'module';
    `;
    expect(hasCreateRequireImport(content)).toBe(true);
  });

  it('should return false when file does not import createRequire', () => {
    const content = `import { something } from 'module';`;
    expect(hasCreateRequireImport(content)).toBe(false);
  });

  it('should return false when file imports from different module', () => {
    const content = `import { createRequire } from 'other-module';`;
    expect(hasCreateRequireImport(content)).toBe(false);
  });
});

describe('hasRequireDefinition', () => {
  it('should return true when file defines require with const', () => {
    const content = `const require = createRequire(import.meta.url);`;
    expect(hasRequireDefinition(content)).toBe(true);
  });

  it('should return true when file defines require with let', () => {
    const content = `let require = createRequire(import.meta.url);`;
    expect(hasRequireDefinition(content)).toBe(true);
  });

  it('should return true when file defines require with var', () => {
    const content = `var require = createRequire(import.meta.url);`;
    expect(hasRequireDefinition(content)).toBe(true);
  });

  it('should return true when file defines require without spaces', () => {
    const content = `const require=createRequire(import.meta.url);`;
    expect(hasRequireDefinition(content)).toBe(true);
  });

  it('should return true when file defines require inside a function', () => {
    const content = `
      function getAbsolutePath(value: string): string {
        const require = createRequire(import.meta.url);
        return require.resolve(value);
      }
    `;
    expect(hasRequireDefinition(content)).toBe(true);
  });

  it('should return false when file does not define require', () => {
    const content = `const something = createRequire(import.meta.url);`;
    expect(hasRequireDefinition(content)).toBe(false);
  });

  it('should return false when require is not using createRequire', () => {
    const content = `const require = something();`;
    expect(hasRequireDefinition(content)).toBe(false);
  });
});
