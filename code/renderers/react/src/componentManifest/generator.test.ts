import { beforeEach, expect, test, vi } from 'vitest';

import { type StoryIndexGenerator } from 'storybook/internal/core-server';

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { componentManifestGenerator } from './generator';

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal()),
  // Keep it simple: hardcode known inputs to expected outputs for this test.
  resolveImport: (id: string, opts: { basedir: string }) => {
    const basedir = opts?.basedir;
    return basedir === '/app/src/stories' && id === './Button'
      ? './src/stories/Button.tsx'
      : basedir === '/app/src/stories' && id === './Header'
        ? './src/stories/Header.tsx'
        : id;
  },
  JsPackageManagerFactory: {
    getPackageManager: () => ({
      primaryPackageJson: {
        packageJson: {
          name: 'some-package',
        },
      },
    }),
  },
}));
vi.mock('node:fs/promises', async () => (await import('memfs')).fs.promises);
vi.mock('node:fs', async () => (await import('memfs')).fs);

vi.mock('empathic/find', async () => ({
  up: (path: string) => '/app/package.json',
}));
vi.mock('tsconfig-paths', () => ({ loadConfig: () => ({ resultType: null!, message: null! }) }));

// Use the provided indexJson from this file
const indexJson = {
  v: 5,
  entries: {
    'example-button--primary': {
      type: 'story',
      subtype: 'story',
      id: 'example-button--primary',
      name: 'Primary',
      title: 'Example/Button',
      importPath: './src/stories/Button.stories.ts',
      componentPath: './src/stories/Button.tsx',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      exportName: 'Primary',
    },
    'example-button--secondary': {
      type: 'story',
      subtype: 'story',
      id: 'example-button--secondary',
      name: 'Secondary',
      title: 'Example/Button',
      importPath: './src/stories/Button.stories.ts',
      componentPath: './src/stories/Button.tsx',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      exportName: 'Secondary',
    },
    'example-button--large': {
      type: 'story',
      subtype: 'story',
      id: 'example-button--large',
      name: 'Large',
      title: 'Example/Button',
      importPath: './src/stories/Button.stories.ts',
      componentPath: './src/stories/Button.tsx',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      exportName: 'Large',
    },
    'example-button--small': {
      type: 'story',
      subtype: 'story',
      id: 'example-button--small',
      name: 'Small',
      title: 'Example/Button',
      importPath: './src/stories/Button.stories.ts',
      componentPath: './src/stories/Button.tsx',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      exportName: 'Small',
    },
    'example-header--docs': {
      id: 'example-header--docs',
      title: 'Example/Header',
      name: 'Docs',
      importPath: './src/stories/Header.stories.ts',
      type: 'docs',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      storiesImports: [],
    },
    'example-header--logged-in': {
      type: 'story',
      subtype: 'story',
      id: 'example-header--logged-in',
      name: 'Logged In',
      title: 'Example/Header',
      importPath: './src/stories/Header.stories.ts',
      componentPath: './src/stories/Header.tsx',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      exportName: 'LoggedIn',
    },
    'example-header--logged-out': {
      type: 'story',
      subtype: 'story',
      id: 'example-header--logged-out',
      name: 'Logged Out',
      title: 'Example/Header',
      importPath: './src/stories/Header.stories.ts',
      componentPath: './src/stories/Header.tsx',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      exportName: 'LoggedOut',
    },
  },
};

beforeEach(() => {
  vi.spyOn(process, 'cwd').mockReturnValue('/app');
  vol.fromJSON(
    {
      ['./package.json']: JSON.stringify({ name: 'some-package' }),
      ['./src/stories/Button.stories.ts']: dedent`
        import type { Meta, StoryObj } from '@storybook/react';
        import { fn } from 'storybook/test';
        import { Button } from './Button';
        
        const meta = {
          component: Button,
          args: { onClick: fn() },
        } satisfies Meta<typeof Button>;
        export default meta;
        type Story = StoryObj<typeof meta>;
        
        export const Primary: Story = { args: { primary: true,  label: 'Button' } };
        export const Secondary: Story = { args: { label: 'Button' } };
        export const Large: Story = { args: { size: 'large', label: 'Button' } };
        export const Small: Story = { args: { size: 'small', label: 'Button' } };`,
      ['./src/stories/Button.tsx']: dedent`
        import React from 'react';
        export interface ButtonProps {
          /** Description of primary */
          primary?: boolean;
          backgroundColor?: string;
          size?: 'small' | 'medium' | 'large';
          label: string;
          onClick?: () => void;
        }
        
        /** Primary UI component for user interaction */
        export const Button = ({
          primary = false,
          size = 'medium',
          backgroundColor,
          label,
          ...props
        }: ButtonProps) => {
          const mode = primary ? 'storybook-button--primary' : 'storybook-button--secondary';
          return (
            <button
              type="button"
              className={['storybook-button', \`storybook-button--\${size}\`, mode].join(' ')}
              style={{ backgroundColor }}
              {...props}
            >
              {label}
            </button>
          );
        };`,
      ['./src/stories/Header.stories.ts']: dedent`
        import type { Meta, StoryObj } from '@storybook/react';
        import { fn } from 'storybook/test';
        import Header from './Header';
        
        /** 
          * Description from meta and very long.
          * @summary Component summary
          * @import import { Header } from '@design-system/components/Header';
          */
        const meta = {
          component: Header,
          args: {
            onLogin: fn(),
            onLogout: fn(),
            onCreateAccount: fn(),
          }
        } satisfies Meta<typeof Header>;
        export default meta;
        type Story = StoryObj<typeof meta>;
        export const LoggedIn: Story = { args: { user: { name: 'Jane Doe' } } };
        export const LoggedOut: Story = {};
        `,
      ['./src/stories/Header.tsx']: dedent`
        import { Button } from './Button';
        
        export interface HeaderProps {
          user?: User;
          onLogin?: () => void;
          onLogout?: () => void;
          onCreateAccount?: () => void;
        }
        
        export default ({ user, onLogin, onLogout, onCreateAccount }: HeaderProps) => (
          <header>
            <div className="storybook-header">
              <div>
                {user ? (
                  <>
                    <span className="welcome">
                      Welcome, <b>{user.name}</b>!
                    </span>
                    <Button size="small" onClick={onLogout} label="Log out" />
                  </>
                ) : (
                  <>
                    <Button size="small" onClick={onLogin} label="Log in" />
                    <Button primary size="small" onClick={onCreateAccount} label="Sign up" />
                  </>
                )}
              </div>
            </div>
          </header>
      );`,
    },
    '/app'
  );
  return () => vol.reset();
});

test('componentManifestGenerator generates correct id, name, description and examples ', async () => {
  const generator = await componentManifestGenerator(undefined, { configDir: '.storybook' } as any);
  const manifest = await generator?.({
    getIndex: async () => indexJson,
  } as unknown as StoryIndexGenerator);

  expect(manifest).toMatchInlineSnapshot(`
    {
      "components": {
        "example-button": {
          "description": "Primary UI component for user interaction",
          "error": undefined,
          "id": "example-button",
          "import": "import { Button } from "some-package";",
          "jsDocTags": {},
          "name": "Button",
          "path": "./src/stories/Button.stories.ts",
          "reactDocgen": {
            "actualName": "Button",
            "definedInFile": "/app/src/stories/Button.tsx",
            "description": "Primary UI component for user interaction",
            "displayName": "Button",
            "exportName": "Button",
            "methods": [],
            "props": {
              "backgroundColor": {
                "description": "",
                "required": false,
                "tsType": {
                  "name": "string",
                },
              },
              "label": {
                "description": "",
                "required": true,
                "tsType": {
                  "name": "string",
                },
              },
              "onClick": {
                "description": "",
                "required": false,
                "tsType": {
                  "name": "signature",
                  "raw": "() => void",
                  "signature": {
                    "arguments": [],
                    "return": {
                      "name": "void",
                    },
                  },
                  "type": "function",
                },
              },
              "primary": {
                "defaultValue": {
                  "computed": false,
                  "value": "false",
                },
                "description": "Description of primary",
                "required": false,
                "tsType": {
                  "name": "boolean",
                },
              },
              "size": {
                "defaultValue": {
                  "computed": false,
                  "value": "'medium'",
                },
                "description": "",
                "required": false,
                "tsType": {
                  "elements": [
                    {
                      "name": "literal",
                      "value": "'small'",
                    },
                    {
                      "name": "literal",
                      "value": "'medium'",
                    },
                    {
                      "name": "literal",
                      "value": "'large'",
                    },
                  ],
                  "name": "union",
                  "raw": "'small' | 'medium' | 'large'",
                },
              },
            },
          },
          "stories": [
            {
              "name": "Primary",
              "snippet": "const Primary = () => <Button onClick={fn()} primary label="Button"></Button>;",
            },
            {
              "name": "Secondary",
              "snippet": "const Secondary = () => <Button onClick={fn()} label="Button"></Button>;",
            },
            {
              "name": "Large",
              "snippet": "const Large = () => <Button onClick={fn()} size="large" label="Button"></Button>;",
            },
            {
              "name": "Small",
              "snippet": "const Small = () => <Button onClick={fn()} size="small" label="Button"></Button>;",
            },
          ],
          "summary": undefined,
        },
        "example-header": {
          "description": "Description from meta and very long.",
          "error": undefined,
          "id": "example-header",
          "import": "import { Header } from "some-package";",
          "jsDocTags": {
            "import": [
              "import { Header } from '@design-system/components/Header';",
            ],
            "summary": [
              "Component summary",
            ],
          },
          "name": "Header",
          "path": "./src/stories/Header.stories.ts",
          "reactDocgen": {
            "actualName": "",
            "definedInFile": "/app/src/stories/Header.tsx",
            "description": "",
            "exportName": "default",
            "methods": [],
            "props": {
              "onCreateAccount": {
                "description": "",
                "required": false,
                "tsType": {
                  "name": "signature",
                  "raw": "() => void",
                  "signature": {
                    "arguments": [],
                    "return": {
                      "name": "void",
                    },
                  },
                  "type": "function",
                },
              },
              "onLogin": {
                "description": "",
                "required": false,
                "tsType": {
                  "name": "signature",
                  "raw": "() => void",
                  "signature": {
                    "arguments": [],
                    "return": {
                      "name": "void",
                    },
                  },
                  "type": "function",
                },
              },
              "onLogout": {
                "description": "",
                "required": false,
                "tsType": {
                  "name": "signature",
                  "raw": "() => void",
                  "signature": {
                    "arguments": [],
                    "return": {
                      "name": "void",
                    },
                  },
                  "type": "function",
                },
              },
              "user": {
                "description": "",
                "required": false,
                "tsType": {
                  "name": "User",
                },
              },
            },
          },
          "stories": [
            {
              "name": "LoggedIn",
              "snippet": "const LoggedIn = () => <Header
        onLogin={fn()}
        onLogout={fn()}
        onCreateAccount={fn()}
        user={{ name: 'Jane Doe' }}></Header>;",
            },
            {
              "name": "LoggedOut",
              "snippet": "const LoggedOut = () => <Header onLogin={fn()} onLogout={fn()} onCreateAccount={fn()}></Header>;",
            },
          ],
          "summary": "Component summary",
        },
      },
      "v": 0,
    }
  `);
});

async function getManifestForStory(code: string) {
  vol.fromJSON(
    {
      ['./package.json']: JSON.stringify({ name: 'some-package' }),
      ['./src/stories/Button.stories.ts']: code,
      ['./src/stories/Button.tsx']: dedent`
        import React from 'react';
        export interface ButtonProps {
          /** Description of primary */
          primary?: boolean;
        }
        
        /** Primary UI component for user interaction */
        export const Button = ({
          primary = false,
        }: ButtonProps) => {
          const mode = primary ? 'storybook-button--primary' : 'storybook-button--secondary';
          return (
            <button
              type="button"
            ></button>
          );
        };`,
    },
    '/app'
  );

  const generator = await componentManifestGenerator(undefined, { configDir: '.storybook' } as any);
  const indexJson = {
    v: 5,
    entries: {
      'example-button--primary': {
        type: 'story',
        subtype: 'story',
        id: 'example-button--primary',
        name: 'Primary',
        title: 'Example/Button',
        importPath: './src/stories/Button.stories.ts',
        componentPath: './src/stories/Button.tsx',
        tags: ['dev', 'test', 'vitest', 'autodocs'],
        exportName: 'Primary',
      },
    },
  };

  const manifest = await generator?.({
    getIndex: async () => indexJson,
  } as unknown as StoryIndexGenerator);

  return manifest?.components?.['example-button'];
}

function withCSF3(body: string) {
  return dedent`
    import type { Meta } from '@storybook/react';
    import { Button } from './Button';

    const meta = {
      component: Button,
      args: { onClick: fn() },
    } satisfies Meta<typeof Button>;
    export default meta;

    ${body}
  `;
}

test('fall back to index title when no component name', async () => {
  const code = dedent`
    import type { Meta } from '@storybook/react';
    import { Button } from './Button';

    export default {
      args: { onClick: fn() },
    };
    
    export const Primary = () => <Button csf1="story" />;
  `;
  expect(await getManifestForStory(code)).toMatchInlineSnapshot(`
    {
      "description": "Primary UI component for user interaction",
      "error": undefined,
      "id": "example-button",
      "import": "import { Button } from "some-package";",
      "jsDocTags": {},
      "name": "Button",
      "path": "./src/stories/Button.stories.ts",
      "reactDocgen": {
        "actualName": "Button",
        "definedInFile": "/app/src/stories/Button.tsx",
        "description": "Primary UI component for user interaction",
        "displayName": "Button",
        "exportName": "Button",
        "methods": [],
        "props": {
          "primary": {
            "defaultValue": {
              "computed": false,
              "value": "false",
            },
            "description": "Description of primary",
            "required": false,
            "tsType": {
              "name": "boolean",
            },
          },
        },
      },
      "stories": [
        {
          "name": "Primary",
          "snippet": "const Primary = () => <Button csf1="story" />;",
        },
      ],
      "summary": undefined,
    }
  `);
});

test('component exported from other file', async () => {
  const code = withCSF3(dedent`
    export { Primary } from './other-file';
  `);
  expect(await getManifestForStory(code)).toMatchInlineSnapshot(`
    {
      "description": "Primary UI component for user interaction",
      "error": undefined,
      "id": "example-button",
      "import": "import { Button } from "some-package";",
      "jsDocTags": {},
      "name": "Button",
      "path": "./src/stories/Button.stories.ts",
      "reactDocgen": {
        "actualName": "Button",
        "definedInFile": "/app/src/stories/Button.tsx",
        "description": "Primary UI component for user interaction",
        "displayName": "Button",
        "exportName": "Button",
        "methods": [],
        "props": {
          "primary": {
            "defaultValue": {
              "computed": false,
              "value": "false",
            },
            "description": "Description of primary",
            "required": false,
            "tsType": {
              "name": "boolean",
            },
          },
        },
      },
      "stories": [
        {
          "error": {
            "message": "Expected story to be a function or variable declaration
       8 | export default meta;
       9 |
    > 10 | export { Primary } from './other-file';
         | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
            "name": "SyntaxError",
          },
          "name": "Primary",
        },
      ],
      "summary": undefined,
    }
  `);
});

test('unknown expressions', async () => {
  const code = withCSF3(dedent`
    export const Primary = someWeirdExpression;
  `);
  expect(await getManifestForStory(code)).toMatchInlineSnapshot(`
    {
      "description": "Primary UI component for user interaction",
      "error": undefined,
      "id": "example-button",
      "import": "import { Button } from "some-package";",
      "jsDocTags": {},
      "name": "Button",
      "path": "./src/stories/Button.stories.ts",
      "reactDocgen": {
        "actualName": "Button",
        "definedInFile": "/app/src/stories/Button.tsx",
        "description": "Primary UI component for user interaction",
        "displayName": "Button",
        "exportName": "Button",
        "methods": [],
        "props": {
          "primary": {
            "defaultValue": {
              "computed": false,
              "value": "false",
            },
            "description": "Description of primary",
            "required": false,
            "tsType": {
              "name": "boolean",
            },
          },
        },
      },
      "stories": [
        {
          "error": {
            "message": "Expected story to be csf factory, function or an object expression
       8 | export default meta;
       9 |
    > 10 | export const Primary = someWeirdExpression;
         |                        ^^^^^^^^^^^^^^^^^^^",
            "name": "SyntaxError",
          },
          "name": "Primary",
        },
      ],
      "summary": undefined,
    }
  `);
});
