/**
 * @file This rule identifies storybook addons that are invalid because they are either not
 *   installed or contain a typo in their name.
 * @author Andre "andrelas1" Santos
 */
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------
import { vi } from 'vitest';

import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { sep } from 'path';

import ruleTester from '../test-utils';
import rule from './no-uninstalled-addons';

function getProjectRoot(): string {
  return process.cwd().split(sep).pop() || '';
}

const packageJsonPath = getProjectRoot() + '/';

vi.mock('fs', () => ({
  ...vi.importActual('fs'),
  readFileSync: () => `
    {
      "devDependencies": {
        "@storybook/addon-essentials": "^6.5.9",
        "@storybook/addon-interactions": "^6.5.9",
        "@storybook/preset-create-react-app": "^6.5.9",
        "@storybook/addon-links": "^6.5.9",
        "storybook-addon-valid-addon": "0.0.1",
        "addon-without-the-prefix": "^0.0.1"
      }
    }
  `,
}));

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

ruleTester.run('no-uninstalled-addons', rule, {
  valid: [
    `
    export default {
      addons: [
        "@storybook/addon-links",
        "@storybook/addon-essentials",
        "@storybook/addon-interactions",
        "@storybook/preset-create-react-app"
      ]
    }
  `,
    `
    export default {
      addons: [
        "@storybook/addon-links",
        "@storybook/addon-essentials",
        "@storybook/addon-interactions",
        "@storybook/preset-create-react-app"
      ]
    } satisfies StorybookConfig
  `,
    `
     const config: StorybookConfig = {
        addons: [
        "@storybook/addon-links",
        "@storybook/addon-essentials",
        "@storybook/addon-interactions",
        "@storybook/preset-create-react-app"
        ]
      }
      export default config
  `,
    `
    export const addons = [
      "@storybook/addon-links",
      "@storybook/addon-essentials",
      "@storybook/addon-interactions",
    ]
  `,
    `
    module.exports = {
        addons: [
          "@storybook/addon-links",
          "@storybook/addon-essentials",
          "@storybook/addon-interactions",
        ]
      }
  `,
    `
    module.exports = {
        addons: [
          "storybook-addon-valid-addon/register",
          "addon-without-the-prefix/preset",
        ]
      }
  `,
    `
    module.exports = {
        addons: [
          "@storybook/addon-links",
          "@storybook/addon-essentials",
          "@storybook/addon-interactions",
          "storybook-addon-valid-addon",
        ]
      }
  `,
    `
    module.exports = {
        addons: [
          "@storybook/addon-links",
          "@storybook/addon-essentials",
          "@storybook/addon-interactions",
          "addon-without-the-prefix",
        ]
      }
  `,
    `
      module.exports = {
          addons: [
            "../my-local-addon",
            "../my-local-addon/index.cjs",
            "/Users/foo/my-local-addon/index.js",
            "/mount/foo/my-local-addon/index.js",
            "C:\\Users\\foo\\my-local-addon/index.js",
            "D:\\Users\\foo\\my-local-addon/index.js",
          ]
        }
    `,
    `
    module.exports = {
        addons: [
          {
            name: "@storybook/addon-links",
          },
          "@storybook/addon-essentials",
          "@storybook/addon-interactions",
          {
            name: "addon-without-the-prefix",
          },
          {
            name: "storybook-addon-valid-addon/register.js",
          },
        ]
      }
  `,
    {
      code: `
      module.exports = {
          addons: [
            "@storybook/addon-links",
            "@storybook/addon-essentials",
            "@storybook/addon-interactions",
            "@storybook/not-installed-addon",
          ]
        }
    `,
      options: [
        {
          packageJsonLocation: '',
          ignore: ['@storybook/not-installed-addon'],
        },
      ],
    },
  ],
  invalid: [
    {
      code: `
      module.exports = {
        addons: [
          "@storybook/addon-links",
          "@storybook/addon-essentials",
          "@storybook/addon-interactions",
          '@storybook/not-installed-addon'
        ]
      }
      `,
      errors: [
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: '@storybook/not-installed-addon',
            packageJsonPath,
          },
        },
      ],
    },
    {
      code: `
      module.exports = {
        addons: [
          "@storybook/addon-links",
          "@storybook/addon-essentials",
          "@storybook/addon-interactions",
          {
            name: '@storybook/not-installed-addon'
          }
        ]
      }
      `,
      errors: [
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: '@storybook/not-installed-addon',
            packageJsonPath,
          },
        },
      ],
    },
    {
      code: `
      module.exports = {
        addons: [
          "@storybook/addon-links",
          {
            name: "@storybook/addon-esentials",
          },
          "@storybook/addon-interactions",
        ]
      }
      `,
      errors: [
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: '@storybook/addon-esentials',
            packageJsonPath,
          },
        },
      ],
    },
    {
      code: `
      module.exports = {
        addons: [
          "@storybook/addon-links",
          "@storybook/adon-essentials",
          "@storybook/addon-interactions",
        ]
      }
      `,
      errors: [
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: '@storybook/adon-essentials',
            packageJsonPath,
          },
        },
      ],
    },
    {
      code: `
      module.exports = {
        addons: [
          "@storybook/addon-links",
          "@storybook/addon-essentials",
          "@storybook/addon-interactions",
          "addon-withut-the-prefix",
          "@storybook/addon-esentials",
        ]
      }
      `,
      errors: [
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: 'addon-withut-the-prefix',
            packageJsonPath,
          },
        },
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: '@storybook/addon-esentials',
            packageJsonPath,
          },
        },
      ],
    },
    {
      code: `
      export default {
        addons: [
          "@storybook/addon-links",
          "@storybook/addon-essentials",
          "@storybook/addon-interactions",
          "addon-withut-the-prefix",
          "@storybook/addon-esentials",
        ]
      }
      `,
      errors: [
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: 'addon-withut-the-prefix',
            packageJsonPath,
          },
        },
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: '@storybook/addon-esentials',
            packageJsonPath,
          },
        },
      ],
    },
    {
      code: `
      export default {
        addons: [
          "@storybook/addon-links",
          "@storybook/addon-essentials",
          "@storybook/addon-interactions",
          "addon-withut-the-prefix",
          "@storybook/addon-esentials",
        ]
      } satisfies StorybookConfig
      `,
      errors: [
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: 'addon-withut-the-prefix',
            packageJsonPath,
          },
        },
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: '@storybook/addon-esentials',
            packageJsonPath,
          },
        },
      ],
    },
    {
      code: `
      const config: StorybookConfig = {
        addons: [
          "@storybook/addon-links",
          "@storybook/addon-essentials",
          "@storybook/addon-interactions",
          "addon-withut-the-prefix",
          "@storybook/addon-esentials",
        ]
      }
      export default config
      `,
      errors: [
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: 'addon-withut-the-prefix',
            packageJsonPath,
          },
        },
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: '@storybook/addon-esentials',
            packageJsonPath,
          },
        },
      ],
    },
    {
      code: `
        export const addons = [
          "../my-local-addon",
          "@storybook/addon-links",
          "@storybook/addon-essentials",
          "@storybook/addon-interactions",
          "addon-withut-the-prefix",
          "@storybook/addon-esentials",
        ]
      `,
      errors: [
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: 'addon-withut-the-prefix',
            packageJsonPath,
          },
        },
        {
          messageId: 'addonIsNotInstalled',
          type: AST_NODE_TYPES.Literal,
          data: {
            addonName: '@storybook/addon-esentials',
            packageJsonPath,
          },
        },
      ],
    },
  ],
});
