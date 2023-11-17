import { describe, expect, test } from 'vitest';

import { extractStories } from './extract-stories.js';

describe('extractSource', () => {
  test('Simple Story', () => {
    expect(
      extractStories(`
        <script>
          import { Story } from '@storybook/svelte';
        </script>

        <Story name="MyStory">
          <div>a story</div>
        </Story>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "Story",
        ],
        "meta": {},
        "stories": {
          "MyStory": {
            "hasArgs": false,
            "name": "MyStory",
            "source": "<div>a story</div>",
            "template": false,
          },
        },
      }
    `);
  });
  test('Explicit Id Story', () => {
    expect(
      extractStories(`
        <script>
          import { Story } from '@storybook/svelte';
        </script>

        <Story id="myId" name="MyStory">
          <div>a story</div>
        </Story>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "Story",
        ],
        "meta": {},
        "stories": {
          "myId": {
            "hasArgs": false,
            "name": "MyStory",
            "source": "<div>a story</div>",
            "template": false,
          },
        },
      }
    `);
  });
  test('Args Story', () => {
    expect(
      extractStories(`
        <script>
          import { Story } from '@storybook/svelte';
        </script>

        <Story name="MyStory" let:args>
          <div>a story</div>
        </Story>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "Story",
        ],
        "meta": {},
        "stories": {
          "MyStory": {
            "hasArgs": true,
            "name": "MyStory",
            "source": "<div>a story</div>",
            "template": false,
          },
        },
      }
    `);
  });
  test('Simple Template', () => {
    expect(
      extractStories(`
        <script>
          import { Template } from '@storybook/svelte';
        </script>

        <Template name="MyTemplate">
          <div>a template</div>
        </Template>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "Template",
        ],
        "meta": {},
        "stories": {
          "tpl:MyTemplate": {
            "hasArgs": false,
            "name": "MyTemplate",
            "source": "<div>a template</div>",
            "template": true,
          },
        },
      }
    `);
  });
  test('Unnamed Template', () => {
    expect(
      extractStories(`
        <script>
          import { Template } from '@storybook/svelte';
        </script>

        <Template>
          <div>a template</div>
        </Template>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "Template",
        ],
        "meta": {},
        "stories": {
          "tpl:default": {
            "hasArgs": false,
            "name": "default",
            "source": "<div>a template</div>",
            "template": true,
          },
        },
      }
    `);
  });
  test('Multiple Stories', () => {
    expect(
      extractStories(`
        <script>
          import { Template } from '@storybook/svelte';
        </script>

        <Story name="Story1">
          <div>story 1</div>
        </Story>
        <Story name="Story2">
          <div>story 2</div>
        </Story>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "Template",
        ],
        "meta": {},
        "stories": {
          "Story1": {
            "hasArgs": false,
            "name": "Story1",
            "source": "<div>story 1</div>",
            "template": false,
          },
          "Story2": {
            "hasArgs": false,
            "name": "Story2",
            "source": "<div>story 2</div>",
            "template": false,
          },
        },
      }
    `);
  });
  test('Renamed Import', () => {
    expect(
      extractStories(`
        <script>
          import { Story as SBStory, Meta as SBMeta } from '@storybook/addon-svelte-csf';
        </script>

        <SBMeta title='test'/>

        <SBStory name="Story1">
          <div>story 1</div>
        </SBStory>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "SBStory",
          "SBMeta",
        ],
        "meta": {
          "id": undefined,
          "title": "test",
        },
        "stories": {
          "Story1": {
            "hasArgs": false,
            "name": "Story1",
            "source": "<div>story 1</div>",
            "template": false,
          },
        },
      }
    `);
  });
  test('Add tags autodocs', () => {
    expect(
      extractStories(`
        <script>
          import { Story, Meta } from '@storybook/addon-svelte-csf';
        </script>

        <Meta title='test' autodocs/>

        <Story name="Story1">
          <div>story 1</div>
        </Story>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "Story",
          "Meta",
        ],
        "meta": {
          "id": undefined,
          "tags": [
            "autodocs",
          ],
          "title": "test",
        },
        "stories": {
          "Story1": {
            "hasArgs": false,
            "name": "Story1",
            "source": "<div>story 1</div>",
            "template": false,
          },
        },
      }
    `);
  });
  test('Add tags', () => {
    expect(
      extractStories(`
        <script>
          import { Story, Meta } from '@storybook/addon-svelte-csf';
        </script>

        <Meta title='test' tags={['a','b']}/>

        <Story name="Story1">
          <div>story 1</div>
        </Story>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "Story",
          "Meta",
        ],
        "meta": {
          "id": undefined,
          "tags": [
            "a",
            "b",
          ],
          "title": "test",
        },
        "stories": {
          "Story1": {
            "hasArgs": false,
            "name": "Story1",
            "source": "<div>story 1</div>",
            "template": false,
          },
        },
      }
    `);
  });
  test('Add Only one tag', () => {
    expect(
      extractStories(`
        <script>
          import { Story, Meta } from '@storybook/addon-svelte-csf';
        </script>

        <Meta title='test' tags='a'/>

        <Story name="Story1">
          <div>story 1</div>
        </Story>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "Story",
          "Meta",
        ],
        "meta": {
          "id": undefined,
          "tags": [
            "a",
          ],
          "title": "test",
        },
        "stories": {
          "Story1": {
            "hasArgs": false,
            "name": "Story1",
            "source": "<div>story 1</div>",
            "template": false,
          },
        },
      }
    `);
  });
  test('Meta as exported module object', () => {
    expect(
      extractStories(`
        <script context='module'>
          export const meta = {
            title: 'MyStory',
            tags: ['a']
          };
        </script>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
        ],
        "meta": {
          "id": undefined,
          "tags": [
            "a",
          ],
          "title": "MyStory",
        },
        "stories": {},
      }
    `);
  });
  test('Meta Description', () => {
    expect(
      extractStories(`
        <script context='module'>
          /**
           * A description of meta
           */ 
          export const meta = {
            title: 'MyStory',
            tags: ['a']
          };
        </script>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
        ],
        "meta": {
          "description": "A description of meta",
          "id": undefined,
          "tags": [
            "a",
          ],
          "title": "MyStory",
        },
        "stories": {},
      }
    `);
  });
  test('Duplicate Id', () => {
    expect(
      extractStories(`
        <script>
          import { Story } from '@storybook/svelte';
          import Button from './Button.svelte';
        </script>

        <Story name="Button">
          <div>a story</div>
        </Story>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "Story",
          "Button",
        ],
        "meta": {},
        "stories": {
          "Button77471352": {
            "hasArgs": false,
            "name": "Button",
            "source": "<div>a story</div>",
            "template": false,
          },
        },
      }
    `);
  });
  test('Meta tag description', () => {
    expect(
      extractStories(`
        <script>
          import { Story } from '@storybook/svelte';
          import Button from './Button.svelte';
        </script>

        <!-- Meta Description -->
        <Meta title="a title"/>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "Story",
          "Button",
        ],
        "meta": {
          "description": "Meta Description",
          "id": undefined,
          "title": "a title",
        },
        "stories": {},
      }
    `);
  });
  test('With description', () => {
    expect(
      extractStories(`
        <script>
          import { Story } from '@storybook/svelte';
          import Button from './Button.svelte';
        </script>

        <!-- Story Description -->

        <Story name="Desc">
          <div>a story</div>
        </Story>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "Story",
          "Button",
        ],
        "meta": {},
        "stories": {
          "Desc": {
            "description": "Story Description",
            "hasArgs": false,
            "name": "Desc",
            "source": "<div>a story</div>",
            "template": false,
          },
        },
      }
    `);
  });
  test('With multiline description', () => {
    expect(
      extractStories(`
        <script>
          import { Story } from '@storybook/svelte';
          import Button from './Button.svelte';
        </script>

        <!-- 
        Story Description 

        another line.
        -->
        
        <Story name="Desc">
          <div>a story</div>
        </Story>
        `)
    ).toMatchInlineSnapshot(`
      {
        "allocatedIds": [
          "default",
          "Story",
          "Button",
        ],
        "meta": {},
        "stories": {
          "Desc": {
            "description": "Story Description 

      another line.",
            "hasArgs": false,
            "name": "Desc",
            "source": "<div>a story</div>",
            "template": false,
          },
        },
      }
    `);
  });
  test('With unrelated nested description', () => {
    expect(
      extractStories(`
          <script>
            import { Story } from '@storybook/svelte';
            import Button from './Button.svelte';
          </script>
  
          <div>
            <!-- unrelated desc -->
          </div>
          <Story name="Desc">
            <div>a story</div>
          </Story>
          `)
    ).toMatchInlineSnapshot(`
        {
          "allocatedIds": [
            "default",
            "Story",
            "Button",
          ],
          "meta": {},
          "stories": {
            "Desc": {
              "hasArgs": false,
              "name": "Desc",
              "source": "<div>a story</div>",
              "template": false,
            },
          },
        }
      `);
  });
  test('With unrelated description', () => {
    expect(
      extractStories(`
          <script>
            import { Story } from '@storybook/svelte';
            import Button from './Button.svelte';
          </script>
  
          <!-- unrelated desc -->
          <div></div>
          <Story name="Desc">
            <div>a story</div>
          </Story>
          `)
    ).toMatchInlineSnapshot(`
        {
          "allocatedIds": [
            "default",
            "Story",
            "Button",
          ],
          "meta": {},
          "stories": {
            "Desc": {
              "hasArgs": false,
              "name": "Desc",
              "source": "<div>a story</div>",
              "template": false,
            },
          },
        }
      `);
  });
});
