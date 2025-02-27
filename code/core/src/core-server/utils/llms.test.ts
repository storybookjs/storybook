import { describe, expect, it } from 'vitest';

import type { StoryIndex } from '../../types';
import { createDocsSections, formatLlmsTxt } from './llms';

describe('llms', () => {
  it('full', async () => {
    const links = [
      {
        title: 'link1',
        href: 'href1',
        description: 'description1',
      },
      {
        title: 'link2',
        href: 'href2',
        description: 'description2',
      },
    ];
    const config = {
      title: 'title',
      description: 'description',
      details: 'details',
      sections: [
        {
          title: 'section1',
          links,
        },
        {
          title: 'section2',
          links,
        },
      ],
    };
    await expect(formatLlmsTxt(config)).resolves.toMatchInlineSnapshot(`
      "# title

      > description

      details

      ## section1

      - [link1](href1) description1
      - [link2](href2) description2

      ## section2

      - [link1](href1) description1
      - [link2](href2) description2"
    `);
  });

  it('optional', async () => {
    const config = {
      title: 'title',
      sections: [
        {
          title: 'section1',
        },
      ],
    };
    await expect(formatLlmsTxt(config)).resolves.toMatchInlineSnapshot(`
      "# title

      ## section1"
    `);
  });

  it('string', async () => {
    const config = 'custom string';
    await expect(formatLlmsTxt(config)).resolves.toMatchInlineSnapshot(`"custom string"`);
  });

  it.only('docs', async () => {
    const index: StoryIndex = {
      entries: {
        docs1: {
          type: 'docs',
          id: 'docs1--docs',
          name: 'docs1',
          title: 'Docs 1',
          importPath: 'asdf',
          storiesImports: [],
        },
        docs2: {
          type: 'docs',
          id: 'docs2--docs',
          name: 'docs2',
          title: 'Docs 2',
          importPath: 'asdf',
          storiesImports: [],
        },
      },
      v: 5,
    };
    expect(createDocsSections(index)).toMatchInlineSnapshot(`
      [
        {
          "links": [
            {
              "href": "?id=docs1--docs",
              "title": "Docs 1 docs1",
            },
            {
              "href": "?id=docs2--docs",
              "title": "Docs 2 docs2",
            },
          ],
          "title": "Docs",
        },
      ]
    `);
  });

  describe('errors', () => {
    it('no title', async () => {
      const noTitle = {
        description: 'description',
      };
      // @ts-expect-error testing error case
      await expect(formatLlmsTxt(noTitle)).resolves.toMatchInlineSnapshot(`"> description"`);
    });

    it('no section title', async () => {
      const noSectionTitle = {
        title: 'title',
        sections: [
          {
            links: [],
          },
        ],
      };
      // @ts-expect-error testing error case
      await expect(formatLlmsTxt(noSectionTitle)).resolves.toMatchInlineSnapshot(`"# title"`);
    });

    it('no links', async () => {
      const noLinks = {
        title: 'title',
        sections: [
          {
            title: 'section1',
            links: [{}],
          },
        ],
      };
      // @ts-expect-error testing error case
      await expect(formatLlmsTxt(noLinks)).resolves.toMatchInlineSnapshot(`
        "# title

        ## section1"
      `);
    });
  });
});
