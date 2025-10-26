```ts filename="vitest.config.ts" renderer="react" tabTitle="Vitest 4"
import { defineConfig, defineProject, mergeConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Use `workspace` field in Vitest < 3.2
      projects: [
        defineProject({
          extends: true,
          plugins: [
            storybookTest({
              // The location of your Storybook config, main.js|ts
              configDir: path.join(dirname, '.storybook'),
              // This should match your package.json script to run Storybook
              // The --ci flag will skip prompts and not open a browser
              storybookScript: 'yarn storybook --ci',
            }),
          ],
          test: {
            name: 'storybook',
            // Enable browser mode
            browser: {
              enabled: true,
              // Make sure to install Playwright
              provider: playwright({}),
              headless: true,
              instances: [{ browser: 'chromium' }],
            },
            setupFiles: ['./.storybook/vitest.setup.ts'],
          },
        }),
      ],
    },
  }),
);
```

```ts filename="vitest.config.ts" renderer="react" tabTitle="Vitest 3"
import { defineConfig, defineProject, mergeConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Use `workspace` field in Vitest < 3.2
      projects: [
        defineProject({
          extends: true,
          plugins: [
            storybookTest({
              // The location of your Storybook config, main.js|ts
              configDir: path.join(dirname, '.storybook'),
              // This should match your package.json script to run Storybook
              // The --ci flag will skip prompts and not open a browser
              storybookScript: 'yarn storybook --ci',
            }),
          ],
          test: {
            name: 'storybook',
            // Enable browser mode
            browser: {
              enabled: true,
              // Make sure to install Playwright
              provider: 'playwright',
              headless: true,
              instances: [{ browser: 'chromium' }],
            },
            setupFiles: ['./.storybook/vitest.setup.ts'],
          },
        }),
      ],
    },
  })
);
```

```ts filename="vitest.config.ts" renderer="vue" tabTitle="Vitest 4"
import { defineConfig, defineProject, mergeConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Use `workspace` field in Vitest < 3.2
      projects: [
        defineProject({
          extends: true,
          plugins: [
            storybookTest({
              // The location of your Storybook config, main.js|ts
              configDir: path.join(dirname, '.storybook'),
              // This should match your package.json script to run Storybook
              // The --ci flag will skip prompts and not open a browser
              storybookScript: 'yarn storybook --ci',
            }),
          ],
          test: {
            name: 'storybook',
            // Enable browser mode
            browser: {
              enabled: true,
              // Make sure to install Playwright
              provider: playwright({}),
              headless: true,
              instances: [{ browser: 'chromium' }],
            },
            setupFiles: ['./.storybook/vitest.setup.ts'],
          },
        }),
      ],
    },
  }),
);
```

```ts filename="vitest.config.ts" renderer="vue" tabTitle="Vitest 3"
import { defineConfig, defineProject, mergeConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import viteConfig from './vite.config';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Use `workspace` field in Vitest < 3.2
      projects: [
        defineProject({
          extends: true,
          plugins: [
            storybookTest({
              // The location of your Storybook config, main.js|ts
              configDir: path.join(dirname, '.storybook'),
              // This should match your package.json script to run Storybook
              // The --ci flag will skip prompts and not open a browser
              storybookScript: 'yarn storybook --ci',
            }),
          ],
          test: {
            name: 'storybook',
            // Enable browser mode
            browser: {
              enabled: true,
              // Make sure to install Playwright
              provider: 'playwright',
              headless: true,
              instances: [{ browser: 'chromium' }],
            },
            setupFiles: ['./.storybook/vitest.setup.ts'],
          },
        }),
      ],
    },
  })
);
```

```ts filename="vitest.config.ts" renderer="svelte" tabTitle="Vitest 4"
import { defineConfig, defineProject, mergeConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Use `workspace` field in Vitest < 3.2
      projects: [
        defineProject({
          extends: true,
          plugins: [
            storybookTest({
              // The location of your Storybook config, main.js|ts
              configDir: path.join(dirname, '.storybook'),
              // This should match your package.json script to run Storybook
              // The --ci flag will skip prompts and not open a browser
              storybookScript: 'yarn storybook --ci',
            }),
          ],
          test: {
            name: 'storybook',
            // Enable browser mode
            browser: {
              enabled: true,
              // Make sure to install Playwright
              provider: playwright({}),
              headless: true,
              instances: [{ browser: 'chromium' }],
            },
            setupFiles: ['./.storybook/vitest.setup.ts'],
          },
        }),
      ],
    },
  }),
);
```

```ts filename="vitest.config.ts" renderer="svelte" tabTitle="Vitest 3"
import { defineConfig, defineProject, mergeConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Use `workspace` field in Vitest < 3.2
      projects: [
        defineProject({
          extends: true,
          plugins: [
            storybookTest({
              // The location of your Storybook config, main.js|ts
              configDir: path.join(dirname, '.storybook'),
              // This should match your package.json script to run Storybook
              // The --ci flag will skip prompts and not open a browser
              storybookScript: 'yarn storybook --ci',
            }),
          ],
          test: {
            name: 'storybook',
            // Enable browser mode
            browser: {
              enabled: true,
              // Make sure to install Playwright
              provider: 'playwright',
              headless: true,
              instances: [{ browser: 'chromium' }],
            },
            setupFiles: ['./.storybook/vitest.setup.ts'],
          },
        }),
      ],
    },
  }),
);
```

```ts filename="vitest.config.ts" renderer="web-components" tabTitle="Vitest 4"
import { defineConfig, defineProject, mergeConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Use `workspace` field in Vitest < 3.2
      projects: [
        defineProject({
          extends: true,
          plugins: [
            storybookTest({
              // The location of your Storybook config, main.js|ts
              configDir: path.join(dirname, '.storybook'),
              // This should match your package.json script to run Storybook
              // The --ci flag will skip prompts and not open a browser
              storybookScript: 'yarn storybook --ci',
            }),
          ],
          test: {
            name: 'storybook',
            // Enable browser mode
            browser: {
              enabled: true,
              // Make sure to install Playwright
              provider: playwright({}),
              headless: true,
              instances: [{ browser: 'chromium' }],
            },
            setupFiles: ['./.storybook/vitest.setup.ts'],
          },
        }),
      ],
    },
  }),
);
```

```ts filename="vitest.config.ts" renderer="web-components" tabTitle="Vitest 3"
import { defineConfig, defineProject, mergeConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Use `workspace` field in Vitest < 3.2
      projects: [
        defineProject({
          extends: true,
          plugins: [
            storybookTest({
              // The location of your Storybook config, main.js|ts
              configDir: path.join(dirname, '.storybook'),
              // This should match your package.json script to run Storybook
              // The --ci flag will skip prompts and not open a browser
              storybookScript: 'yarn storybook --ci',
            }),
          ],
          test: {
            name: 'storybook',
            // Enable browser mode
            browser: {
              enabled: true,
              // Make sure to install Playwright
              provider: 'playwright',
              headless: true,
              instances: [{ browser: 'chromium' }],
            },
            setupFiles: ['./.storybook/vitest.setup.ts'],
          },
        }),
      ],
    },
  })
);
```
