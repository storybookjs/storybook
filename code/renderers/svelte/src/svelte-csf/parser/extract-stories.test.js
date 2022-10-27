import { extractStories } from './extract-stories';

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
        "stories": Object {
          "MyStory": Object {
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
      Object {
        "allocatedIds": Array [
          "default",
          "Story",
        ],
        "stories": Object {
          "myId": Object {
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
      Object {
        "allocatedIds": Array [
          "default",
          "Story",
        ],
        "stories": Object {
          "MyStory": Object {
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
      Object {
        "allocatedIds": Array [
          "default",
          "Template",
        ],
        "stories": Object {
          "tpl:MyTemplate": Object {
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
      Object {
        "allocatedIds": Array [
          "default",
          "Template",
        ],
        "stories": Object {
          "tpl:default": Object {
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
      Object {
        "allocatedIds": Array [
          "default",
          "Template",
        ],
        "stories": Object {
          "Story1": Object {
            "hasArgs": false,
            "name": "Story1",
            "source": "<div>story 1</div>",
            "template": false,
          },
          "Story2": Object {
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
      Object {
        "allocatedIds": Array [
          "default",
          "SBStory",
          "SBMeta",
        ],
        "stories": Object {
          "Story1": Object {
            "hasArgs": false,
            "name": "Story1",
            "source": "<div>story 1</div>",
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
        "stories": Object {
          "Button77471352": Object {
            "hasArgs": false,
            "name": "Button",
            "source": "<div>a story</div>",
            "template": false,
          },
        },
      }
    `);
  });
});
