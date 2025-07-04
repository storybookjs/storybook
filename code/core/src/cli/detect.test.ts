import { existsSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager, PackageJsonWithMaybeDeps } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { detect, detectFrameworkPreset, detectLanguage } from './detect';
import { ProjectType, SupportedLanguage } from './project_types';

vi.mock('./helpers', () => ({
  isNxProject: vi.fn(),
}));

vi.mock(import('fs'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

vi.mock('storybook/internal/node-logger');
vi.mock('find-up');

const MOCK_FRAMEWORK_FILES: {
  name: string;
  files: Record<'package.json', PackageJsonWithMaybeDeps> | Record<string, string>;
}[] = [
  {
    name: ProjectType.VUE3,
    files: {
      'package.json': {
        dependencies: {
          vue: '^3.0.0',
        },
      },
    },
  },
  {
    name: ProjectType.NUXT,
    files: {
      'package.json': {
        dependencies: {
          nuxt: '^3.11.2',
        },
      },
    },
  },
  {
    name: ProjectType.NUXT,
    files: {
      'package.json': {
        dependencies: {
          // Nuxt projects may have Vue 3 as an explicit dependency
          nuxt: '^3.11.2',
          vue: '^3.0.0',
        },
      },
    },
  },
  {
    name: ProjectType.VUE3,
    files: {
      'package.json': {
        dependencies: {
          // Testing the `next` tag too
          vue: 'next',
        },
      },
    },
  },
  {
    name: ProjectType.EMBER,
    files: {
      'package.json': {
        devDependencies: {
          'ember-cli': '1.0.0',
        },
      },
    },
  },
  {
    name: ProjectType.REACT_PROJECT,
    files: {
      'package.json': {
        peerDependencies: {
          react: '1.0.0',
        },
      },
    },
  },
  {
    name: ProjectType.QWIK,
    files: {
      'package.json': {
        devDependencies: {
          '@builder.io/qwik': '1.0.0',
        },
      },
    },
  },
  {
    name: ProjectType.REACT_NATIVE,
    files: {
      'package.json': {
        dependencies: {
          'react-native': '1.0.0',
        },
        devDependencies: {
          'react-native-scripts': '1.0.0',
        },
      },
    },
  },
  {
    name: ProjectType.REACT_SCRIPTS,
    files: {
      'package.json': {
        devDependencies: {
          'react-scripts': '1.0.0',
        },
      },
    },
  },
  {
    name: ProjectType.WEBPACK_REACT,
    files: {
      'package.json': {
        dependencies: {
          react: '1.0.0',
        },
        devDependencies: {
          webpack: '1.0.0',
        },
      },
    },
  },
  {
    name: ProjectType.REACT,
    files: {
      'package.json': {
        dependencies: {
          react: '1.0.0',
        },
      },
    },
  },
  {
    name: ProjectType.NEXTJS,
    files: {
      'package.json': {
        dependencies: {
          next: '^9.0.0',
        },
      },
    },
  },
  {
    name: ProjectType.ANGULAR,
    files: {
      'package.json': {
        dependencies: {
          '@angular/core': '1.0.0',
        },
      },
    },
  },
  {
    name: ProjectType.WEB_COMPONENTS,
    files: {
      'package.json': {
        dependencies: {
          'lit-element': '1.0.0',
        },
      },
    },
  },
  {
    name: ProjectType.WEB_COMPONENTS,
    files: {
      'package.json': {
        dependencies: {
          'lit-html': '1.4.1',
        },
      },
    },
  },
  {
    name: ProjectType.WEB_COMPONENTS,
    files: {
      'package.json': {
        dependencies: {
          'lit-html': '2.0.0-rc.3',
        },
      },
    },
  },
  {
    name: ProjectType.WEB_COMPONENTS,
    files: {
      'package.json': {
        dependencies: {
          lit: '2.0.0-rc.2',
        },
      },
    },
  },
  {
    name: ProjectType.PREACT,
    files: {
      'package.json': {
        dependencies: {
          preact: '1.0.0',
        },
      },
    },
  },
  {
    name: ProjectType.SVELTE,
    files: {
      'package.json': {
        dependencies: {
          svelte: '1.0.0',
        },
      },
    },
  },
];

describe('Detect', () => {
  it(`should return type HTML if html option is passed`, async () => {
    const packageManager = {
      primaryPackageJson: {
        packageJson: {
          dependencies: {},
          devDependencies: {},
          peerDependencies: {},
        },
        packageJsonPath: 'some/path',
        operationDir: 'some/path',
      },
      getAllDependencies: () => ({}),
      getModulePackageJSON: () => null,
    } as Partial<JsPackageManager>;

    await expect(detect(packageManager as any, { html: true })).resolves.toBe(ProjectType.HTML);
  });

  it(`should return language javascript if the TS dependency is present but less than minimum supported`, async () => {
    vi.mocked(logger.warn).mockClear();

    const packageManager = {
      getAllDependencies: () => ({
        typescript: '1.0.0',
      }),
      getModulePackageJSON: (packageName) => {
        switch (packageName) {
          case 'typescript':
            return {
              version: '1.0.0',
            };
          default:
            return null;
        }
      },
    } as Partial<JsPackageManager>;

    await expect(detectLanguage(packageManager as any)).resolves.toBe(SupportedLanguage.JAVASCRIPT);
    expect(logger.warn).toHaveBeenCalledWith(
      'Detected TypeScript < 4.9 or incompatible tooling, populating with JavaScript examples'
    );
  });

  it(`should return language javascript if the TS dependency is <4.9`, async () => {
    const packageManager = {
      getAllDependencies: () => ({
        typescript: '4.8.0',
      }),
      getModulePackageJSON: (packageName: string) => {
        switch (packageName) {
          case 'typescript':
            return {
              version: '4.8.0',
            };
          default:
            return null;
        }
      },
    } as Partial<JsPackageManager>;
    await expect(detectLanguage(packageManager as any)).resolves.toBe(SupportedLanguage.JAVASCRIPT);
  });

  it(`should return language typescript-4-9 if the dependency is >TS4.9`, async () => {
    const packageManager = {
      getAllDependencies: () => ({
        typescript: '4.9.1',
      }),
      getModulePackageJSON: (packageName: string) => {
        switch (packageName) {
          case 'typescript':
            return {
              version: '4.9.1',
            };
          default:
            return null;
        }
      },
    } as Partial<JsPackageManager>;
    await expect(detectLanguage(packageManager as any)).resolves.toBe(SupportedLanguage.TYPESCRIPT);
  });

  it(`should return language typescript if the dependency is =TS4.9`, async () => {
    const packageManager = {
      getAllDependencies: () => ({
        typescript: '4.9.0',
      }),
      getModulePackageJSON: (packageName: string) => {
        switch (packageName) {
          case 'typescript':
            return {
              version: '4.9.0',
            };
          default:
            return null;
        }
      },
    } as Partial<JsPackageManager>;
    await expect(detectLanguage(packageManager as any)).resolves.toBe(SupportedLanguage.TYPESCRIPT);
  });

  it(`should return language JavaScript if the dependency is =TS4.9beta`, async () => {
    const packageManager = {
      getAllDependencies: () => ({
        typescript: '4.9.0-beta',
      }),
      getModulePackageJSON: (packageName: string) => {
        switch (packageName) {
          case 'typescript':
            return {
              version: '4.9.0-beta',
            };
          default:
            return null;
        }
      },
    } as Partial<JsPackageManager>;

    await expect(detectLanguage(packageManager as any)).resolves.toBe(SupportedLanguage.JAVASCRIPT);
  });

  it(`should return language javascript by default`, async () => {
    const packageManager = {
      getAllDependencies: () => ({}),
      getModulePackageJSON: () => null,
    } as Partial<JsPackageManager>;

    await expect(detectLanguage(packageManager as any)).resolves.toBe(SupportedLanguage.JAVASCRIPT);
  });

  it(`should return language Javascript even when Typescript is detected in the node_modules but not listed as a direct dependency`, async () => {
    const packageManager = {
      getAllDependencies: () => ({}),
      getModulePackageJSON: (packageName) => {
        switch (packageName) {
          case 'typescript':
            return {
              version: '4.9.0',
            };
          default:
            return null;
        }
      },
    } as Partial<JsPackageManager>;

    await expect(detectLanguage(packageManager as any)).resolves.toBe(SupportedLanguage.JAVASCRIPT);
  });

  describe('detectFrameworkPreset should return', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    MOCK_FRAMEWORK_FILES.forEach((structure) => {
      it(`${structure.name}`, () => {
        vi.mocked(existsSync).mockImplementation((filePath) => {
          return typeof filePath === 'string' && Object.keys(structure.files).includes(filePath);
        });

        const result = detectFrameworkPreset(
          structure.files['package.json'] as PackageJsonWithMaybeDeps
        );

        expect(result).toBe(structure.name);
      });
    });

    it(`UNDETECTED for unknown frameworks`, () => {
      const result = detectFrameworkPreset();
      expect(result).toBe(ProjectType.UNDETECTED);
    });

    // TODO: The mocking in this test causes tests after it to fail
    it('REACT_SCRIPTS for custom react scripts config', () => {
      const forkedReactScriptsConfig = {
        '/node_modules/.bin/react-scripts': 'file content',
      };

      vi.mocked(existsSync).mockImplementation((filePath) => {
        return (
          typeof filePath === 'string' && Object.keys(forkedReactScriptsConfig).includes(filePath)
        );
      });

      const result = detectFrameworkPreset();
      expect(result).toBe(ProjectType.REACT_SCRIPTS);
    });
  });
});
