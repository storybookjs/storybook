import { beforeEach, expect, test, vi } from 'vitest';

import { Tag } from 'storybook/internal/core-server';

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { fsMocks, indexJson } from './fixtures';
import { manifests } from './generator';

beforeEach(() => {
  vi.spyOn(process, 'cwd').mockReturnValue('/app');
  vol.fromJSON(fsMocks, '/app');
});

test('manifests generates correct id, name, description and examples ', async () => {
  const manifestEntries = Object.values(indexJson.entries).filter(
    (entry) => entry.tags?.includes(Tag.MANIFEST) ?? false
  );
  const result = await manifests(undefined, { manifestEntries } as any);

  expect(result?.components).toMatchInlineSnapshot(`
    {
      "components": {
        "example-button": {
          "description": "Primary UI component for user interaction",
          "error": undefined,
          "id": "example-button",
          "import": "import { Button } from "@design-system/components/override";",
          "jsDocTags": {
            "import": [
              "import { Button } from '@design-system/components/override';",
            ],
          },
          "name": "Button",
          "path": "./src/stories/Button.stories.ts",
          "reactDocgen": {
            "actualName": "Button",
            "definedInFile": "./src/stories/Button.tsx",
            "description": "Primary UI component for user interaction
    @import import { Button } from '@design-system/components/override';",
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
              "description": undefined,
              "id": "example-button--primary",
              "name": "Primary",
              "snippet": "const Primary = () => <Button onClick={fn()} primary label="Button" />;",
              "summary": undefined,
            },
            {
              "description": undefined,
              "id": "example-button--secondary",
              "name": "Secondary",
              "snippet": "const Secondary = () => <Button onClick={fn()} label="Button" />;",
              "summary": undefined,
            },
            {
              "description": undefined,
              "id": "example-button--large",
              "name": "Large",
              "snippet": "const Large = () => <Button onClick={fn()} size="large" label="Button" />;",
              "summary": undefined,
            },
            {
              "description": undefined,
              "id": "example-button--small",
              "name": "Small",
              "snippet": "const Small = () => <Button onClick={fn()} size="small" label="Button" />;",
              "summary": undefined,
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
            "summary": [
              "Component summary",
            ],
          },
          "name": "Header",
          "path": "./src/stories/Header.stories.ts",
          "reactDocgen": {
            "actualName": "",
            "definedInFile": "./src/stories/Header.tsx",
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
              "description": undefined,
              "id": "example-header--logged-in",
              "name": "Logged In",
              "snippet": "const LoggedIn = () => <Header
        onLogin={fn()}
        onLogout={fn()}
        onCreateAccount={fn()}
        user={{ name: 'Jane Doe' }} />;",
              "summary": undefined,
            },
            {
              "description": undefined,
              "id": "example-header--logged-out",
              "name": "Logged Out",
              "snippet": "const LoggedOut = () => <Header onLogin={fn()} onLogout={fn()} onCreateAccount={fn()} />;",
              "summary": undefined,
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

  const manifestEntries = [
    {
      type: 'story',
      subtype: 'story',
      id: 'example-button--primary',
      name: 'Primary',
      title: 'Example/Button',
      importPath: './src/stories/Button.stories.ts',
      componentPath: './src/stories/Button.tsx',
      tags: [Tag.DEV, Tag.TEST, 'vitest', Tag.AUTODOCS, Tag.MANIFEST],
      exportName: 'Primary',
    },
  ];

  const result = await manifests(undefined, { manifestEntries } as any);

  return result?.components?.components?.['example-button'];
}

function withCSF3(body: string) {
  return dedent`
    import type { Meta } from '@storybook/react';
    import { Button } from './Button';

    const meta = {
      title: 'Example/Button',
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
      title: 'Example/Button',
      args: { onClick: fn() },
      tags: ['manifest'],
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
        "definedInFile": "./src/stories/Button.tsx",
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
          "description": undefined,
          "id": "example-button--primary",
          "name": "Primary",
          "snippet": "const Primary = () => <Button csf1="story" />;",
          "summary": undefined,
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
        "definedInFile": "./src/stories/Button.tsx",
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
       9 | export default meta;
      10 |
    > 11 | export { Primary } from './other-file';
         | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^",
            "name": "SyntaxError",
          },
          "id": "example-button--primary",
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
        "definedInFile": "./src/stories/Button.tsx",
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
       9 | export default meta;
      10 |
    > 11 | export const Primary = someWeirdExpression;
         |                        ^^^^^^^^^^^^^^^^^^^",
            "name": "SyntaxError",
          },
          "id": "example-button--primary",
          "name": "Primary",
        },
      ],
      "summary": undefined,
    }
  `);
});

test('should create component manifest when only attached-mdx docs have manifest tag', async () => {
  // This test verifies that the React renderer creates a component manifest entry
  // when only an attached-mdx docs entry has the 'manifest' tag (and no story entries do).
  // Note: The `docs` property of the component manifest is added by addon-docs, not by this generator,
  // so it is not part of this test's snapshot.
  vol.fromJSON(
    {
      ['./package.json']: JSON.stringify({ name: 'some-package' }),
      ['./src/stories/Button.stories.ts']: dedent`
        import type { Meta, StoryObj } from '@storybook/react';
        import { fn } from 'storybook/test';
        import { Button } from './Button';

        const meta = {
          title: 'Example/Button',
          component: Button,
          args: { onClick: fn() },
        } satisfies Meta<typeof Button>;
        export default meta;
        type Story = StoryObj<typeof meta>;

        export const Primary: Story = { args: { primary: true, label: 'Button', tags: ['!manifest'] } };
      `,
      ['./src/stories/Button.tsx']: dedent`
        import React from 'react';
        export interface ButtonProps {
          /** Description of primary */
          primary?: boolean;
          label: string;
        }

        /** Primary UI component for user interaction */
        export const Button = ({
          primary = false,
          label,
        }: ButtonProps) => {
          return <button type="button">{label}</button>;
        };
      `,
    },
    '/app'
  );

  // Only docs entry has manifest tag, story does not
  const manifestEntries = [
    {
      type: 'docs',
      id: 'example-button--docs',
      name: 'Docs',
      title: 'Example/Button',
      importPath: './src/stories/Button.mdx',
      tags: [Tag.DEV, Tag.TEST, Tag.MANIFEST, Tag.ATTACHED_MDX],
      storiesImports: ['./src/stories/Button.stories.ts'],
    },
  ];

  expect(await manifests(undefined, { manifestEntries } as any)).toMatchInlineSnapshot(`
    {
      "components": {
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
              "definedInFile": "./src/stories/Button.tsx",
              "description": "Primary UI component for user interaction",
              "displayName": "Button",
              "exportName": "Button",
              "methods": [],
              "props": {
                "label": {
                  "description": "",
                  "required": true,
                  "tsType": {
                    "name": "string",
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
              },
            },
            "stories": [],
            "summary": undefined,
          },
        },
        "v": 0,
      },
    }
  `);
});

test('should extract story description and summary from JSDoc comments', async () => {
  const code = withCSF3(dedent`
    /**
     * This is a longer description of the Primary story
     * 
     * @summary This is a brief summary
     */
    export const Primary = () => <Button onClick={fn()} primary label="Button" />;
  `);
  const manifest = await getManifestForStory(code);

  expect(manifest?.stories).toMatchInlineSnapshot(`
    [
      {
        "description": "This is a longer description of the Primary story",
        "id": "example-button--primary",
        "name": "Primary",
        "snippet": "const Primary = () => <Button onClick={fn()} primary label="Button" />;",
        "summary": "This is a brief summary",
      },
    ]
  `);
});
