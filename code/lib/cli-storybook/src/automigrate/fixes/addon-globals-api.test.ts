import * as fsp from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { printCsf } from 'storybook/internal/csf-tools';

// Import common to mock
import dedent from 'ts-dedent';

// Import FixResult type
import { addonGlobalsApi, transformStoryFile } from './addon-globals-api';

// Mock fs/promises
vi.mock('node:fs/promises', async () => import('../../../../../__mocks__/fs/promises'));

vi.mock(import('storybook/internal/babel'), async (actualImport) => {
  const actual = await actualImport();
  return {
    ...actual,
    recast: {
      ...actual.recast,
      print: (ast, options) => actual.recast.print(ast, { ...options, quote: 'single' }),
    },
  };
});

const previewConfigPath = join('.storybook', 'preview.js');

const check = async (previewContents: string) => {
  vi.mocked<typeof import('../../../../../__mocks__/fs/promises')>(fsp as any).__setMockFiles({
    [previewConfigPath]: previewContents,
  });
  return addonGlobalsApi.check({
    packageManager: {} as any,
    configDir: '',
    mainConfig: {} as any,
    storybookVersion: '9.0.0', // Assume v9 for testing migrations
    previewConfigPath,
    storiesPaths: [],
  });
};

// Helper to run the migration for preview file and capture transform function
const runMigrationAndGetTransformFn = async (previewContents: string) => {
  const result = await check(previewContents);
  const mockWriteFile = vi.mocked(fsp.writeFile);

  let transformFn: (filePath: string, content: string) => string | null = () => null;

  let transformOptions: any;

  if (result) {
    await addonGlobalsApi.run?.({
      result,
      dryRun: false,
      storiesPaths: ['**/*.stories.{js,jsx,ts,tsx,mdx}'], // Mock stories paths
      packageManager: {} as any, // Add necessary mock properties
    } as any);

    if (result) {
      // Create a transform function that uses transformStoryFile + printCsf
      transformFn = (filePath: string, content: string) => {
        const transformed = transformStoryFile(content, {
          needsViewportMigration: result.needsViewportMigration,
          needsBackgroundsMigration: result.needsBackgroundsMigration,
          viewportsOptions: result.viewportsOptions,
          backgroundsOptions: result.backgroundsOptions,
        });
        return transformed ? printCsf(transformed, {}).code : null;
      };
      // Extract options passed to transformStoryFile from the closure
      // This is a bit indirect, relying on the implementation detail
      transformOptions = {
        needsViewportMigration: result.needsViewportMigration,
        needsBackgroundsMigration: result.needsBackgroundsMigration,
        backgroundValues: result.backgroundsOptions?.values,
      };
    }
  }

  return {
    previewFileContent: mockWriteFile.mock.calls[0]?.[1] as string | undefined,
    transformFn,
    transformOptions,
    migrationResult: result,
  };
};

describe('addon-globals-api', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('check', () => {
    it('should return null for empty config', async () => {
      await expect(check(`export default { parameters: {} }`)).resolves.toBeFalsy();
    });

    it('should detect viewport configuration', async () => {
      const result = await check(`
        export default {
          parameters: {
            viewport: {
              viewports: {
                mobile: { name: 'Mobile', width: '320px', height: '568px' },
                tablet: { name: 'Tablet', width: '768px', height: '1024px' }
              },
              defaultViewport: 'mobile'
            }
          }
        }
      `);

      expect(result).toBeTruthy();
      expect(result?.needsViewportMigration).toBe(true);
      expect(result?.needsBackgroundsMigration).toBe(false);
      expect(result?.viewportsOptions?.defaultViewport).toBe('mobile');
    });

    it('should detect backgrounds configuration', async () => {
      const result = await check(`
        export default {
          parameters: {
            backgrounds: {
              values: [
                { name: 'Light', value: '#F8F8F8' },
                { name: 'Dark', value: '#333333' }
              ],
              default: 'Light',
              disable: false
            }
          }
        }
      `);

      expect(result).toBeTruthy();
      expect(result?.needsViewportMigration).toBe(false);
      expect(result?.needsBackgroundsMigration).toBe(true);
      expect(result?.backgroundsOptions?.default).toBe('Light');
    });

    it('should detect both viewport and backgrounds configuration', async () => {
      const result = await check(`
        export default {
          parameters: {
            viewport: {
              viewports: {
                mobile: { name: 'Mobile', width: '320px', height: '568px' },
                tablet: { name: 'Tablet', width: '768px', height: '1024px' }
              },
              defaultViewport: 'tablet'
            },
            backgrounds: {
              values: [
                { name: 'Light', value: '#F8F8F8' },
                { name: 'Dark', value: '#333333' }
              ],
              default: 'Dark'
            }
          }
        }
      `);

      expect(result).toBeTruthy();
      expect(result?.needsViewportMigration).toBe(true);
      expect(result?.needsBackgroundsMigration).toBe(true);
      expect(result?.viewportsOptions?.defaultViewport).toBe('tablet');
      expect(result?.backgroundsOptions?.default).toBe('Dark');
    });

    it('should detect both viewport and backgrounds configuration with dynamic values', async () => {
      const result = await check(`
        import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

        const backgroundValues = [
          { name: 'Light', value: '#F8F8F8' },
          { name: 'Dark', value: '#333333' }
        ];

        export default {
          parameters: {
            viewport: {
              viewports: INITIAL_VIEWPORTS,
              defaultViewport: 'tablet'
            },
            backgrounds: {
              values: backgroundValues,
              default: 'Dark'
            }
          }
        }
      `);

      expect(result).toBeTruthy();
      expect(result?.needsViewportMigration).toBe(true);
      expect(result?.needsBackgroundsMigration).toBe(true);
      expect(result?.viewportsOptions?.defaultViewport).toBe('tablet');
      expect(result?.backgroundsOptions?.default).toBe('Dark');
    });

    it('should not detect configurations already using globals API', async () => {
      const result = await check(`
        export default {
          parameters: {
            viewport: {
              options: {
                mobile: { name: 'Mobile', width: '320px', height: '568px' },
                tablet: { name: 'Tablet', width: '768px', height: '1024px' }
              }
            },
            backgrounds: {
              options: {
                light: { name: 'Light', value: '#F8F8F8' },
                dark: { name: 'Dark', value: '#333333' }
              }
            }
          },
          initialGlobals: {
            viewport: { value: 'mobile', isRotated: false },
            backgrounds: { value: 'dark' }
          }
        }
      `);

      // Since there's no defaultViewport or default properties, it should return null (nothing to migrate)
      expect(result?.needsViewportMigration).toBeFalsy();
      expect(result?.needsBackgroundsMigration).toBeFalsy();
    });
  });

  describe('run - preview file', () => {
    it('should migrate viewport configuration correctly', async () => {
      const { previewFileContent } = await runMigrationAndGetTransformFn(dedent`
        export default {
          parameters: {
            viewport: {
              viewports: {
                mobile: { name: 'Mobile', width: '320px', height: '568px' },
                tablet: { name: 'Tablet', width: '768px', height: '1024px' }
              },
              defaultViewport: 'mobile'
            }
          }
        }
      `);

      expect(previewFileContent).toMatchInlineSnapshot(`
        "export default {
          parameters: {
            viewport: {
              options: {
                mobile: { name: 'Mobile', width: '320px', height: '568px' },
                tablet: { name: 'Tablet', width: '768px', height: '1024px' }
              }
            }
          },

          initialGlobals: {
            viewport: {
              value: 'mobile',
              isRotated: false
            }
          }
        };"
      `);
    });

    it('should migrate backgrounds configuration correctly', async () => {
      const { previewFileContent } = await runMigrationAndGetTransformFn(dedent`
        export default {
          parameters: {
            backgrounds: {
              values: [
                { name: 'Light', value: '#F8F8F8' },
                { name: 'Dark', value: '#333333' }
              ],
              default: 'Light'
            }
          }
        }
      `);

      expect(previewFileContent).toMatchInlineSnapshot(`
        "export default {
          parameters: {
            backgrounds: {
              options: {
                light: { name: 'Light', value: '#F8F8F8' },
                dark: { name: 'Dark', value: '#333333' }
              }
            }
          },

          initialGlobals: {
            backgrounds: {
              value: 'light'
            }
          }
        };"
      `);
    });

    it('should rename backgrounds disable property to disabled', async () => {
      const { previewFileContent } = await runMigrationAndGetTransformFn(dedent`
        export default {
          parameters: {
            backgrounds: {
              values: [
                { name: 'Light', value: '#F8F8F8' }
              ],
              disable: true
            }
          }
        }
      `);

      // Verify the transformation results
      expect(previewFileContent).toMatchInlineSnapshot(`
        "export default {
          parameters: {
            backgrounds: {
              options: {
                light: { name: 'Light', value: '#F8F8F8' }
              },
              disabled: true
            }
          }
        }"
      `);
    });

    it('should migrate both viewport and backgrounds configurations', async () => {
      const { previewFileContent } = await runMigrationAndGetTransformFn(dedent`
        export default {
          parameters: {
            viewport: {
              viewports: {
                mobile: { name: 'Mobile', width: '320px', height: '568px' }
              },
              defaultViewport: 'mobile'
            },
            backgrounds: {
              values: [
                { name: 'Light', value: '#F8F8F8' },
                { name: 'Dark', value: '#333333' }
              ],
              default: 'Light'
            }
          }
        }
      `);

      expect(previewFileContent).toMatchInlineSnapshot(`
  "export default {
    parameters: {
      viewport: {
        options: {
          mobile: { name: 'Mobile', width: '320px', height: '568px' }
        }
      },
      backgrounds: {
        options: {
          light: { name: 'Light', value: '#F8F8F8' },
          dark: { name: 'Dark', value: '#333333' }
        }
      }
    },

    initialGlobals: {
      viewport: {
        value: 'mobile',
        isRotated: false
      },

      backgrounds: {
        value: 'light'
      }
    }
  };"
`);
    });

    it('should correctly handle partial configurations', async () => {
      const { previewFileContent } = await runMigrationAndGetTransformFn(dedent`
        export default {
          parameters: {
            viewport: {
              viewports: {
                mobile: { name: 'Mobile', width: '320px', height: '568px' }
              }
            },
            backgrounds: {
              values: [
                { name: 'Light', value: '#F8F8F8' }
              ]
            }
          }
        }
      `);

      // Verify the transformation results
      expect(previewFileContent).toMatchInlineSnapshot(`
        "export default {
          parameters: {
            viewport: {
              options: {
                mobile: { name: 'Mobile', width: '320px', height: '568px' }
              }
            },
            backgrounds: {
              options: {
                light: { name: 'Light', value: '#F8F8F8' }
              }
            }
          }
        }"
      `);
    });

    it('should migrate dynamic values correctly', async () => {
      const { previewFileContent } = await runMigrationAndGetTransformFn(dedent`
        import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

        export default {
          parameters: {
            viewport: {
              viewports: INITIAL_VIEWPORTS,
              defaultViewport: 'tablet'
            },
            backgrounds: {
              values: [
                { name: 'Light', value: '#F8F8F8' },
                { name: 'Dark', value: '#333333' }
              ],
              default: 'Light'
            }
          }
        }
      `);

      expect(previewFileContent).toMatchInlineSnapshot(`
        "import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

        export default {
          parameters: {
            viewport: {
              options: INITIAL_VIEWPORTS
            },
            backgrounds: {
              options: {
                light: { name: 'Light', value: '#F8F8F8' },
                dark: { name: 'Dark', value: '#333333' }
              }
            }
          },

          initialGlobals: {
            viewport: {
              value: 'tablet',
              isRotated: false
            },

            backgrounds: {
              value: 'light'
            }
          }
        };"
      `);
    });

    it('should migrate complex backgrounds configuration with dots and brackets in names', async () => {
      const { previewFileContent } = await runMigrationAndGetTransformFn(dedent`
        export default {
          parameters: {
            backgrounds: {
              default: 'palette.neutral[100]',
              values: [
                {
                  name: 'palette.neutral[100]',
                  value: palette.neutral[100],
                },
              ],
            }
          }
        }
      `);

      expect(previewFileContent).toMatchInlineSnapshot(`
  "export default {
    parameters: {
      backgrounds: {
        options: {
          'palette.neutral[100]': {
            name: 'palette.neutral[100]',
            value: palette.neutral[100],
          }
        }
      }
    },

    initialGlobals: {
      backgrounds: {
        value: 'palette.neutral[100]'
      }
    }
  };"
`);
    });
  });

  describe('run - story files', () => {
    const defaultPreview = dedent`
      export default {
        parameters: {
          viewport: {
            viewports: { mobile: {}, tablet: {} },
            defaultViewport: 'mobile'
          },
          backgrounds: {
            values: [
              { name: 'Light', value: '#F8F8F8' },
              { name: 'Dark', value: '#333333' },
              { name: 'Tweet', value: '#00aced' }
            ],
            default: 'Light',
            disable: false
          }
        }
      }
    `;

    it('should migrate parameters.backgrounds.default to globals.backgrounds', async () => {
      const { transformFn } = await runMigrationAndGetTransformFn(defaultPreview);
      const storyContent = dedent`
          import Button from './Button';
          export default { component: Button };
          export const Default = {
            parameters: {
              backgrounds: { default: 'Dark' }
            }
          };
        `;

      expect(transformFn).toBeDefined();
      expect(transformFn!('story.js', storyContent)).toMatchInlineSnapshot(`
        "import Button from './Button';
        export default { component: Button };
        export const Default = {
          globals: {
            backgrounds: {
              value: 'dark'
            }
          }
        };"
      `);
    });

    it('should migrate parameters.backgrounds.disable: true to disabled: true', async () => {
      const { transformFn } = await runMigrationAndGetTransformFn(defaultPreview);
      const storyContent = dedent`
          import Button from './Button';
          export default { component: Button };
          export const Disabled = {
            parameters: {
              backgrounds: { disable: true }
            }
          };
        `;
      expect(transformFn).toBeDefined();
      expect(transformFn!('story.js', storyContent)).toMatchInlineSnapshot(`
        "import Button from './Button';
        export default { component: Button };
        export const Disabled = {
          parameters: {
            backgrounds: { disabled: true }
          }
        };"
      `);
    });

    it('should rename parameters.backgrounds.disable: false to disabled: false', async () => {
      const { transformFn } = await runMigrationAndGetTransformFn(defaultPreview);
      const storyContent = dedent`
          import Button from './Button';
          export default { component: Button };
          export const Disabled = {
            parameters: {
              backgrounds: { disable: false }
            }
          };
        `;
      expect(transformFn).toBeDefined();
      expect(transformFn!('story.js', storyContent)).toMatchInlineSnapshot(`
        "import Button from './Button';
        export default { component: Button };
        export const Disabled = {
          parameters: {
            backgrounds: { disabled: false }
          }
        };"
      `);
    });

    it('should migrate parameters.viewport.defaultViewport to globals.viewport', async () => {
      const { transformFn } = await runMigrationAndGetTransformFn(defaultPreview);
      const storyContent = dedent`
          import Button from './Button';
          export default { component: Button };
          export const MobileOnly = {
            parameters: {
              viewport: { defaultViewport: 'mobile' }
            }
          };
        `;
      expect(transformFn).toBeDefined();
      expect(transformFn!('story.js', storyContent)).toMatchInlineSnapshot(`
        "import Button from './Button';
        export default { component: Button };
        export const MobileOnly = {
          globals: {
            viewport: {
              value: 'mobile',
              isRotated: false
            }
          }
        };"
      `);
    });

    it('should migrate both viewport and backgrounds in the same story', async () => {
      const { transformFn } = await runMigrationAndGetTransformFn(defaultPreview);
      const storyContent = dedent`
          import Button from './Button';
          export default { component: Button };
          export const DarkMobile = {
            parameters: {
              viewport: { defaultViewport: 'mobile' },
              backgrounds: { default: 'Dark' }
            }
          };
        `;
      expect(transformFn).toBeDefined();
      expect(transformFn!('story.js', storyContent)).toMatchInlineSnapshot(`
        "import Button from './Button';
        export default { component: Button };
        export const DarkMobile = {
          globals: {
            viewport: {
              value: 'mobile',
              isRotated: false
            },

            backgrounds: {
              value: 'dark'
            }
          }
        };"
      `);
    });

    it('should handle migration in meta (export default)', async () => {
      const { transformFn } = await runMigrationAndGetTransformFn(defaultPreview);
      const storyContent = dedent`
          import Button from './Button';
          export default {
            component: Button,
            parameters: {
              backgrounds: { default: 'Tweet' }
            }
          };
          export const Default = {};
        `;

      expect(transformFn).toBeDefined();
      expect(transformFn!('story.js', storyContent)).toMatchInlineSnapshot(`
        "import Button from './Button';
        export default {
          component: Button,
          globals: {
            backgrounds: {
              value: 'tweet'
            }
          }
        };
        export const Default = {};"
      `);
    });

    it('should return null if no changes are needed', async () => {
      const { transformFn } = await runMigrationAndGetTransformFn(defaultPreview);
      const storyContent = dedent`
        import Button from './Button';
        export default { component: Button };
        export const NoParams = {};
        export const ExistingGlobals = { globals: { backgrounds: { value: 'dark' } } };
        export const ExistingDisabled = { parameters: { backgrounds: { disabled: true } } };
      `;
      expect(transformFn).toBeDefined();
      expect(transformFn!('story.js', storyContent)).toBeNull();
    });

    it('should migrate parameters even when other stories have existing globals', async () => {
      const { transformFn } = await runMigrationAndGetTransformFn(defaultPreview);
      const storyContent = dedent`
        import Button from './Button';

        export default { 
          component: Button 
        };

        export const ExistingGlobals = { 
          globals: { 
            backgrounds: { 
              value: 'dark' 
            } 
          } 
        };

        export const NeedsMigration = { 
          parameters: { 
            backgrounds: { 
              default: 'Dark' 
            } 
          } 
        };
      `;
      expect(transformFn).toBeDefined();
      expect(transformFn!('story.js', storyContent)).toMatchInlineSnapshot(`
        "import Button from './Button';

        export default { 
          component: Button 
        };

        export const ExistingGlobals = { 
          globals: { 
            backgrounds: { 
              value: 'dark' 
            } 
          } 
        };

        export const NeedsMigration = { 
          globals: {
            backgrounds: {
              value: 'dark'
            }
          } 
        };"
      `);
    });

    it('should merge new globals with existing globals in the same story', async () => {
      const { transformFn } = await runMigrationAndGetTransformFn(defaultPreview);
      const storyContent = dedent`
        import Button from './Button';

        export default { component: Button };
        
        export const ExistingAndNeedsMigration = { 
          globals: { 
            backgrounds: { 
              value: 'light' 
            } 
          },
          parameters: {
            backgrounds: {
              default: 'Dark'
            }
          } 
        };
      `;
      expect(transformFn).toBeDefined();
      expect(transformFn!('story.js', storyContent)).toMatchInlineSnapshot(`
        "import Button from './Button';

        export default { component: Button };

        export const ExistingAndNeedsMigration = {
          globals: { 
            backgrounds: { 
              value: 'light' 
            } 
          }
        };"
      `);
    });

    it('should remove empty parameters/backgrounds/viewport objects after migration', async () => {
      const { transformFn } = await runMigrationAndGetTransformFn(defaultPreview);
      const storyContent = dedent`
          import Button from './Button';

          export default { component: Button };

          export const TestStory = {
            parameters: {
              otherParam: true,
              backgrounds: { 
                default: 'Dark' 
              },
              viewport: { 
                defaultViewport: 'tablet'
              }
            }
          };
        `;
      expect(transformFn).toBeDefined();
      expect(transformFn!('story.js', storyContent)).toMatchInlineSnapshot(`
        "import Button from './Button';

        export default { component: Button };

        export const TestStory = {
          parameters: {
            otherParam: true
          },

          globals: {
            viewport: {
              value: 'tablet',
              isRotated: false
            },

            backgrounds: {
              value: 'dark'
            }
          }
        };"
      `);
    });

    it('should transform defaultOrientation and disabled properties in viewport stories', async () => {
      const { transformFn } = await runMigrationAndGetTransformFn(defaultPreview);
      const storyContent = dedent`
          import Button from './Button';
          export default { component: Button };
          export const Mobile = {
            parameters: {
              viewport: {
                defaultOrientation: 'portrait',
                defaultViewport: 'iphonex',
                disable: true,
              },
            },
          };
        `;
      expect(transformFn).toBeDefined();
      expect(transformFn!('story.js', storyContent)).toMatchInlineSnapshot(`
        "import Button from './Button';
        export default { component: Button };
        export const Mobile = {
          parameters: {
            viewport: {
              disabled: true
            },
          },

          globals: {
            viewport: {
              value: 'iphonex',
              isRotated: true
            }
          }
        };"
      `);
    });

    it('should transform member expression references in viewport stories', async () => {
      const { transformFn } = await runMigrationAndGetTransformFn(defaultPreview);
      const storyContent = dedent`
          import { MINIMAL_VIEWPORTS } from 'storybook/viewport';
          import Button from './Button';
          export default { component: Button };
          export const Mobile = {
            parameters: {
              viewport: {
                defaultViewport: MINIMAL_VIEWPORTS.mobile2
              },
            },
          };
        `;
      expect(transformFn).toBeDefined();
      expect(transformFn!('story.js', storyContent)).toMatchInlineSnapshot(`
        "import { MINIMAL_VIEWPORTS } from 'storybook/viewport';
        import Button from './Button';
        export default { component: Button };
        export const Mobile = {
          globals: {
            viewport: {
              value: MINIMAL_VIEWPORTS.mobile2,
              isRotated: false
            }
          },
        };"
      `);
    });

    it('should transform backgrounds values to options and migrate default in story files', async () => {
      const { transformFn } = await runMigrationAndGetTransformFn(defaultPreview);
      const storyContent = dedent`
          import Button from './Button';
          export default { component: Button };
          export const Mobile = {
            parameters: {
              backgrounds: {
                default: 'Light',
                values: [
                  { name: 'Gray', value: '#CCC' },
                ],
              },
            },
          };
        `;
      expect(transformFn).toBeDefined();
      expect(transformFn!('story.js', storyContent)).toMatchInlineSnapshot(`
        "import Button from './Button';
        export default { component: Button };
        export const Mobile = {
          parameters: {
            backgrounds: {
              options: {
                gray: { name: 'Gray', value: '#CCC' }
              }
            },
          },

          globals: {
            backgrounds: {
              value: 'light'
            }
          }
        };"
      `);
    });
  });
});
