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
      Object {
        "allocatedIds": Array [
          "default",
          "Story",
        ],
        "meta": Object {},
        "stories": Object {
          "MyStory": Object {
            "hasArgs": false,
            "name": "MyStory",
            "source": "<div>a story</div>",
            "storyId": "mystory--my-story",
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
      Object {
        "allocatedIds": Array [
          "default",
          "Story",
        ],
        "meta": Object {},
        "stories": Object {
          "myId": Object {
            "hasArgs": false,
            "name": "MyStory",
            "source": "<div>a story</div>",
            "storyId": "myid--my-id",
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
      Object {
        "allocatedIds": Array [
          "default",
          "Story",
        ],
        "meta": Object {},
        "stories": Object {
          "MyStory": Object {
            "hasArgs": true,
            "name": "MyStory",
            "source": "<div>a story</div>",
            "storyId": "mystory--my-story",
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
      Object {
        "allocatedIds": Array [
          "default",
          "Template",
        ],
        "meta": Object {},
        "stories": Object {
          "tpl:MyTemplate": Object {
            "hasArgs": false,
            "name": "MyTemplate",
            "source": "<div>a template</div>",
            "storyId": "mytemplate--my-template",
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
      Object {
        "allocatedIds": Array [
          "default",
          "Template",
        ],
        "meta": Object {},
        "stories": Object {
          "tpl:default": Object {
            "hasArgs": false,
            "name": "default",
            "source": "<div>a template</div>",
            "storyId": "default--default",
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
      Object {
        "allocatedIds": Array [
          "default",
          "Template",
        ],
        "meta": Object {},
        "stories": Object {
          "Story1": Object {
            "hasArgs": false,
            "name": "Story1",
            "source": "<div>story 1</div>",
            "storyId": "story1--story-1",
            "template": false,
          },
          "Story2": Object {
            "hasArgs": false,
            "name": "Story2",
            "source": "<div>story 2</div>",
            "storyId": "story2--story-2",
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
      Object {
        "allocatedIds": Array [
          "default",
          "SBStory",
          "SBMeta",
        ],
        "meta": Object {
          "id": undefined,
          "title": "test",
        },
        "stories": Object {
          "Story1": Object {
            "hasArgs": false,
            "name": "Story1",
            "source": "<div>story 1</div>",
            "storyId": "test--story-1",
            "template": false,
          },
        },
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
      Object {
        "allocatedIds": Array [
          "default",
          "Story",
          "Button",
        ],
        "meta": Object {},
        "stories": Object {
          "Button77471352": Object {
            "hasArgs": false,
            "name": "Button",
            "source": "<div>a story</div>",
            "storyId": "button77471352--button-77471352",
            "template": false,
          },
        },
      }
    `);
  });
});
