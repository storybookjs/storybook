import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';

import { MANAGER_DOCS_MDX_SPECIFIER } from '../constants.ts';
import { ManagerDocsParseError } from '../errors.ts';
import { parseManagerDocs } from './parse-mdx.ts';

const file = 'page.mdx';

function asNamespaced(source: string, alias = 'SB'): string {
  return `import * as ${alias} from '${MANAGER_DOCS_MDX_SPECIFIER}';\n${source
    .replaceAll('<Story', `<${alias}.Story`)
    .replaceAll('</Story', `</${alias}.Story`)}`;
}

const accepted = `
import * as SB from '${MANAGER_DOCS_MDX_SPECIFIER}';
import * as ButtonStories from './Button.stories';
import { Primary as PrimaryStory } from './Primary.stories.ts';

# Button

The button is **bold** and *italic* and \`code\`.

A [link](https://example.com) and ![Button](./button.png).

> A quote

---

- one
- two
  - nested

1. first
2. second

\`\`\`ts
const value = { ok: true }
\`\`\`

| Name | Value |
| :--- | ---: |
| alpha | 1 |

Button
======

<SB.Story of={ButtonStories.Primary} />

<SB.Story of={ButtonStories.Primary} focus />

<SB.Story
  focus={false}
  of={PrimaryStory.Primary}
/>
`;

function reject(source: string): ManagerDocsParseError {
  try {
    parseManagerDocs(source, file);
  } catch (error) {
    expect(error).toBeInstanceOf(ManagerDocsParseError);
    return error as ManagerDocsParseError;
  }
  throw new Error('expected a parse error');
}

describe('parseManagerDocs', () => {
  it('parses the v0 grammar into imports and blocks', () => {
    const page = parseManagerDocs(accepted, file);

    expect(page.imports.map((statement) => statement.source)).toEqual([
      './Button.stories',
      './Primary.stories.ts',
    ]);
    expect(page.imports[1]?.bindings).toEqual(['PrimaryStory']);
    expect(page.blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'paragraph',
      'blockquote',
      'thematicBreak',
      'list',
      'list',
      'code',
      'table',
      'heading',
      'story',
      'story',
      'story',
    ]);

    const prose = page.blocks[1];
    expect(prose).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'The button is ' },
        { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
        { type: 'text', value: ' and ' },
        { type: 'emphasis', children: [{ type: 'text', value: 'italic' }] },
        { type: 'text', value: ' and ' },
        { type: 'inlineCode', value: 'code' },
        { type: 'text', value: '.' },
      ],
    });

    expect(page.blocks[2]).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'A ' },
        { type: 'link', url: 'https://example.com', children: [{ type: 'text', value: 'link' }] },
        { type: 'text', value: ' and ' },
        { type: 'image', alt: 'Button', url: './button.png' },
        { type: 'text', value: '.' },
      ],
    });

    expect(page.blocks[5]).toMatchObject({
      type: 'list',
      ordered: false,
      items: [
        { children: [{ type: 'paragraph', children: [{ type: 'text', value: 'one' }] }] },
        {
          children: [
            { type: 'paragraph', children: [{ type: 'text', value: 'two' }] },
            {
              type: 'list',
              items: [
                {
                  children: [{ type: 'paragraph', children: [{ type: 'text', value: 'nested' }] }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(page.blocks[7]).toMatchObject({
      type: 'code',
      lang: 'ts',
      value: 'const value = { ok: true }',
    });
    expect(page.blocks[8]).toMatchObject({
      type: 'table',
      align: ['left', 'right'],
      header: [[{ type: 'text', value: 'Name' }], [{ type: 'text', value: 'Value' }]],
    });

    expect(page.blocks.slice(10)).toEqual([
      {
        type: 'story',
        moduleName: 'ButtonStories',
        exportName: 'Primary',
        focus: false,
        position: { line: 34, column: 1 },
      },
      {
        type: 'story',
        moduleName: 'ButtonStories',
        exportName: 'Primary',
        focus: true,
        position: { line: 36, column: 1 },
      },
      {
        type: 'story',
        moduleName: 'PrimaryStory',
        exportName: 'Primary',
        focus: false,
        position: { line: 38, column: 1 },
      },
    ]);
  });

  it.each([
    ['custom component', '<Canvas />\n', 'component', 1, 1],
    ['raw html', '<div>no</div>\n', 'html', 1, 1],
    ['html comment', '<!-- secret -->\n', 'html', 1, 1],
    ['frontmatter', '---\ntitle: Button\n---\n\n# Button\n', 'frontmatter', 1, 1],
    ['string story id', '<Story id="button--primary" />\n', 'story-id', 1, 8],
    ['string of value', '<Story of="button--primary" />\n', 'story-id', 1, 8],
    ['call expression', '<Story of={Button.Primary()} />\n', 'expression', 1, 8],
    ['bare identifier', '<Story of={Primary} />\n', 'expression', 1, 8],
    ['prose expression', 'Count is {count}.\n', 'expression', 1, 10],
    ['export', 'export const x = 1\n', 'export', 1, 1],
    [
      'docs blocks import',
      "import { Meta } from '@storybook/addon-docs/blocks'\n",
      'import',
      1,
      23,
    ],
    ['side-effect import', "import './Button.stories'\n", 'import', 1, 1],
    ['dynamic import', 'import("./Button.stories")\n', 'import', 1, 1],
    ['story children', '<Story of={Button.Primary}>child</Story>\n', 'story-children', 1, 27],
    [
      'extra attribute',
      '<Story of={Button.Primary} layout="centered" />\n',
      'story-attribute',
      1,
      28,
    ],
    ['pixel height', '<Story of={Button.Primary} height="200px" />\n', 'story-height', 1, 28],
    ['zero height', '<Story of={Button.Primary} height="0" />\n', 'story-height', 1, 28],
    ['negative height', '<Story of={Button.Primary} height="-20" />\n', 'story-height', 1, 28],
    ['percent height', '<Story of={Button.Primary} height="50%" />\n', 'story-height', 1, 28],
    ['zero height literal', '<Story of={Button.Primary} height={0} />\n', 'story-height', 1, 28],
    [
      'negative height literal',
      '<Story of={Button.Primary} height={-5} />\n',
      'story-height',
      1,
      28,
    ],
    ['fractional height', '<Story of={Button.Primary} height={480.5} />\n', 'story-height', 1, 28],
    ['height expression', '<Story of={Button.Primary} height={16/9} />\n', 'story-height', 1, 28],
    ['ratio expression', '<Story of={Button.Primary} ratio={16/9} />\n', 'story-ratio', 1, 28],
    ['ratio number literal', '<Story of={Button.Primary} ratio={1.5} />\n', 'story-ratio', 1, 28],
    ['zero ratio', '<Story of={Button.Primary} ratio="0" />\n', 'story-ratio', 1, 28],
    ['negative ratio', '<Story of={Button.Primary} ratio="-1.5" />\n', 'story-ratio', 1, 28],
    ['zero ratio half', '<Story of={Button.Primary} ratio="16/0" />\n', 'story-ratio', 1, 28],
    ['negative ratio half', '<Story of={Button.Primary} ratio="16/-9" />\n', 'story-ratio', 1, 28],
    ['missing ratio half', '<Story of={Button.Primary} ratio="16/" />\n', 'story-ratio', 1, 28],
    ['missing ratio width', '<Story of={Button.Primary} ratio="/9" />\n', 'story-ratio', 1, 28],
    ['extra ratio slash', '<Story of={Button.Primary} ratio="16/9/2" />\n', 'story-ratio', 1, 28],
    ['word ratio', '<Story of={Button.Primary} ratio="wide" />\n', 'story-ratio', 1, 28],
    [
      'height and ratio',
      '<Story of={Button.Primary} height="480" ratio="16/9" />\n',
      'story-attribute',
      1,
      41,
    ],
    [
      'ratio and height',
      '<Story of={Button.Primary} ratio="16/9" height="480" />\n',
      'story-attribute',
      1,
      41,
    ],
    [
      'auto height and ratio',
      '<Story of={Button.Primary} height="auto" ratio="16/9" />\n',
      'story-attribute',
      1,
      42,
    ],
    ['script url', '[click](javascript:alert(1))\n', 'url', 1, 8],
    ['script url with a tab', '[click](java\tscript:alert(1))\n', 'url', 1, 8],
    ['script url with a carriage return', '[click](java\rscript:alert(1))\n', 'url', 1, 8],
    ['script url with a leading null', '[click](\0javascript:alert(1))\n', 'url', 1, 8],
    ['data url with a tab', '![x](da\tta:text/html,hi)\n', 'url', 1, 5],
    ['split focus literal', '<Story of={Button.Primary} focus={tru e} />\n', 'story-focus', 1, 28],
    ['expression in a heading', '# {count}\n', 'expression', 1, 3],
    ['indented export', '  export const x = 1\n', 'export', 1, 3],
    ['component in a blockquote', '> <Canvas />\n', 'component', 1, 3],
    ['meta block in a blockquote', '> <Meta />\n', 'component', 1, 3],
    ['controls block in a blockquote', '> <Controls />\n', 'component', 1, 3],
    ['html in a blockquote', '> <div>no</div>\n', 'html', 1, 3],
    ['string story id in a list', '- <Story id="x" />\n', 'story-id', 1, 10],
    ['reference link', 'See [notes][id].\n', 'markdown', 1, 5],
    ['link definition', '[id]: https://example.com\n', 'markdown', 1, 1],
    [
      'toolbar expression',
      '<Story of={Button.Primary} toolbar={items} />\n',
      'story-toolbar',
      1,
      28,
    ],
    ['toolbar number', '<Story of={Button.Primary} toolbar={1} />\n', 'story-toolbar', 1, 28],
    [
      'toolbar string true',
      '<Story of={Button.Primary} toolbar="true" />\n',
      'story-toolbar',
      1,
      28,
    ],
    [
      'toolbar viewport id list',
      "<Story of={Button.Primary} toolbar={['viewport']} />\n",
      'story-toolbar',
      1,
      28,
    ],
    [
      'toolbar boolean attribute',
      '<Story of={Button.Primary} toolbar />\n',
      'story-toolbar',
      1,
      28,
    ],
    [
      'toolbar string attribute',
      '<Story of={Button.Primary} toolbar="viewport" />\n',
      'story-toolbar',
      1,
      28,
    ],
    [
      'toolbar string expression',
      "<Story of={Button.Primary} toolbar={'viewport'} />\n",
      'story-toolbar',
      1,
      28,
    ],
    [
      'toolbar unknown id',
      "<Story of={Button.Primary} toolbar={['zoom']} />\n",
      'story-toolbar',
      1,
      28,
    ],
    [
      'toolbar panel id',
      "<Story of={Button.Primary} toolbar={['actions']} />\n",
      'story-toolbar',
      1,
      28,
    ],
    [
      'toolbar duplicate id',
      "<Story of={Button.Primary} toolbar={['viewport', 'viewport']} />\n",
      'story-toolbar',
      1,
      28,
    ],
    [
      'toolbar number item',
      '<Story of={Button.Primary} toolbar={[1]} />\n',
      'story-toolbar',
      1,
      28,
    ],
    [
      'toolbar object',
      '<Story of={Button.Primary} toolbar={{ viewport: true }} />\n',
      'story-toolbar',
      1,
      28,
    ],
    [
      'toolbar call',
      "<Story of={Button.Primary} toolbar={['viewport'].concat([])} />\n",
      'story-toolbar',
      1,
      28,
    ],
    [
      'toolbar comment',
      "<Story of={Button.Primary} toolbar={['viewport' /* x */]} />\n",
      'story-toolbar',
      1,
      28,
    ],
    ['panel expression', '<Story of={Button.Primary} panel={items} />\n', 'story-panel', 1, 28],
    [
      'panel call expression',
      "<Story of={Button.Primary} panel={['actions'].concat([])} />\n",
      'story-panel',
      1,
      28,
    ],
    ['panel string true', '<Story of={Button.Primary} panel="true" />\n', 'story-panel', 1, 28],
    ['panel string false', "<Story of={Button.Primary} panel={'false'} />\n", 'story-panel', 1, 28],
    ['panel number', '<Story of={Button.Primary} panel={1} />\n', 'story-panel', 1, 28],
    [
      'panel object',
      '<Story of={Button.Primary} panel={{ actions: true }} />\n',
      'story-panel',
      1,
      28,
    ],
    ['panel bare attribute', '<Story of={Button.Primary} panel />\n', 'story-panel', 1, 28],
    ['panel unknown id', "<Story of={Button.Primary} panel={['a11y']} />\n", 'story-panel', 1, 28],
    [
      'panel toolbar id',
      "<Story of={Button.Primary} panel={['viewport']} />\n",
      'story-panel',
      1,
      28,
    ],
    [
      'panel duplicate id',
      "<Story of={Button.Primary} panel={['actions', 'actions']} />\n",
      'story-panel',
      1,
      28,
    ],
    [
      'panels attribute',
      '<Story of={Button.Primary} panels={["controls"]} />\n',
      'story-panel',
      1,
      28,
    ],
    [
      'duplicate toolbar attribute',
      "<Story of={Button.Primary} toolbar={[]} toolbar={['viewport']} />\n",
      'story-attribute',
      1,
      41,
    ],
    [
      'duplicate panel attribute',
      "<Story of={Button.Primary} panel={[]} panel={['actions']} />\n",
      'story-attribute',
      1,
      39,
    ],
  ] as const)('rejects %s', (_name, source, construct, line, column) => {
    const namespaced = source.includes('<Story');
    const error = reject(namespaced ? asNamespaced(source) : source);
    expect(error.construct).toBe(construct);
    expect(error.file).toBe(file);
    expect(error.line).toBe(namespaced ? line + 1 : line);
    expect(error.column).toBe(namespaced && line === 1 ? column + 3 : column);
  });

  it('parses comparisons and brackets that are not links', () => {
    const page = parseManagerDocs(
      [
        'Width is a < b and score <3 and a <= b.',
        '',
        'The id is **[id]**. Use the [optional] flag. See the [docs](https://example.com).',
        '',
        'import the addon before you start.',
        '',
        'export the tokens from the file.',
        '',
        '- [ ] todo',
        '',
        '> a < b',
        '',
      ].join('\n'),
      file
    );

    expect(page.blocks[0]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'Width is a < b and score <3 and a <= b.' }],
    });
    expect(page.blocks[1]).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'The id is ' },
        { type: 'strong', children: [{ type: 'text', value: '[id]' }] },
        { type: 'text', value: '. Use the [optional] flag. See the ' },
        {
          type: 'link',
          url: 'https://example.com',
          children: [{ type: 'text', value: 'docs' }],
        },
        { type: 'text', value: '.' },
      ],
    });
    expect(page.blocks[2]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'import the addon before you start.' }],
    });
    expect(page.blocks[3]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'export the tokens from the file.' }],
    });
    expect(page.blocks[4]).toMatchObject({
      type: 'list',
      ordered: false,
      items: [
        { children: [{ type: 'paragraph', children: [{ type: 'text', value: '[ ] todo' }] }] },
      ],
    });
    expect(page.blocks[5]).toMatchObject({
      type: 'blockquote',
      children: [{ type: 'paragraph', children: [{ type: 'text', value: 'a < b' }] }],
    });
  });

  it('parses auto, pixel, ratio, and full-pane heights', () => {
    const page = parseManagerDocs(
      [
        `import * as SB from '${MANAGER_DOCS_MDX_SPECIFIER}';`,
        "import * as ButtonStories from './Button.stories';",
        '',
        '<SB.Story of={ButtonStories.Primary} />',
        '',
        '<SB.Story of={ButtonStories.Primary} height="auto" />',
        '',
        "<SB.Story of={ButtonStories.Primary} height={'auto'} />",
        '',
        '<SB.Story of={ButtonStories.Primary} height="480" />',
        '',
        '<SB.Story of={ButtonStories.Primary} height={480} />',
        '',
        '<SB.Story of={ButtonStories.Secondary} ratio="16/9" />',
        '',
        '<SB.Story of={ButtonStories.Secondary} ratio="1.5" />',
        '',
        "<SB.Story of={ButtonStories.Secondary} ratio={'4/3'} />",
        '',
        '<SB.Story of={ButtonStories.Primary} height="100vh" />',
        '',
        "<SB.Story of={ButtonStories.Primary} height={'100vh'} />",
        '',
      ].join('\n'),
      file
    );
    const stories = page.blocks.filter((block) => block.type === 'story');

    expect(stories[0]).not.toHaveProperty('height');
    expect(stories[0]).not.toHaveProperty('ratio');
    expect(stories[1]).not.toHaveProperty('height');
    expect(stories[1]).not.toHaveProperty('ratio');
    expect(stories[2]).not.toHaveProperty('height');
    expect(stories[2]).not.toHaveProperty('ratio');
    expect(stories[3]).toMatchObject({ height: 480 });
    expect(stories[3]).not.toHaveProperty('ratio');
    expect(stories[4]).toMatchObject({ height: 480 });
    expect(stories[4]).not.toHaveProperty('ratio');
    expect(stories[5]).toMatchObject({ ratio: 16 / 9 });
    expect(stories[5]).not.toHaveProperty('height');
    expect(stories[6]).toMatchObject({ ratio: 1.5 });
    expect(stories[6]).not.toHaveProperty('height');
    expect(stories[7]).toMatchObject({ ratio: 4 / 3 });
    expect(stories[7]).not.toHaveProperty('height');
    expect(stories[8]).toMatchObject({ height: '100vh' });
    expect(stories[8]).not.toHaveProperty('ratio');
    expect(stories[9]).toMatchObject({ height: '100vh' });
    expect(stories[9]).not.toHaveProperty('ratio');
  });

  it('locates an invalid size and a size that sets both height and ratio', () => {
    const pixels = reject(asNamespaced('<Story of={Button.Primary} height="200px" />\n'));
    expect(pixels.construct).toBe('story-height');
    expect(pixels.line).toBe(2);
    expect(pixels.column).toBe(31);
    expect(pixels.message).toContain(
      'height must be "auto", a positive integer number of pixels, or "100vh".'
    );

    const ratio = reject(
      asNamespaced(['<Story', '  of={Button.Primary}', '  ratio="16/9/2"', '/>', ''].join('\n'))
    );
    expect(ratio.construct).toBe('story-ratio');
    expect(ratio.line).toBe(4);
    expect(ratio.column).toBe(3);
    expect(ratio.message).toContain('ratio must be a static string such as "16/9".');

    const expression = reject(asNamespaced('<Story of={Button.Primary} ratio={16/9} />\n'));
    expect(expression.construct).toBe('story-ratio');
    expect(expression.line).toBe(2);
    expect(expression.column).toBe(31);
    expect(expression.message).toContain('not an expression');

    const both = reject(
      asNamespaced(
        ['<Story', '  of={Button.Primary}', '  height="480"', '  ratio="16/9"', '/>', ''].join('\n')
      )
    );
    expect(both.construct).toBe('story-attribute');
    expect(both.line).toBe(5);
    expect(both.column).toBe(3);
    expect(both.message).toContain('height and ratio are mutually exclusive.');
  });

  it('parses an omitted panel, booleans, and tab lists in author order', () => {
    const page = parseManagerDocs(
      [
        `import * as SB from '${MANAGER_DOCS_MDX_SPECIFIER}';`,
        "import * as ButtonStories from './Button.stories';",
        '',
        '<SB.Story of={ButtonStories.Primary} />',
        '',
        '<SB.Story of={ButtonStories.Primary} panel={true} />',
        '',
        '<SB.Story of={ButtonStories.Primary} panel={false} />',
        '',
        '<SB.Story of={ButtonStories.Primary} panel={[]} />',
        '',
        "<SB.Story of={ButtonStories.Primary} panel={['actions']} />",
        '',
        "<SB.Story of={ButtonStories.Secondary} panel={['interactions']} />",
        '',
        "<SB.Story of={ButtonStories.Secondary} panel={['interactions', 'actions']} />",
        '',
        "<SB.Story of={ButtonStories.Primary} toolbar={true} panel={['actions', 'interactions']} />",
        '',
        '<SB.Story of={ButtonStories.Secondary} focus height="100vh" toolbar={ [ ] } panel={ [ "actions" , ] } />',
        '',
        '<SB.Story of={ButtonStories.Secondary} toolbar={false} />',
        '',
      ].join('\n'),
      file
    );
    const stories = page.blocks.filter((block) => block.type === 'story');

    expect(stories[0]).not.toHaveProperty('panel');
    expect(stories[1]).toMatchObject({ panel: true });
    expect(stories[2]).toMatchObject({ panel: false });
    expect(stories[3]).toMatchObject({ panel: [] });
    expect(stories[4]).toMatchObject({ panel: ['actions'] });
    expect(stories[5]).toMatchObject({ panel: ['interactions'] });
    expect(stories[6]).toMatchObject({ panel: ['interactions', 'actions'] });
    expect(stories[7]).toMatchObject({
      toolbar: true,
      panel: ['actions', 'interactions'],
    });
    expect(stories[8]).toMatchObject({
      focus: true,
      height: '100vh',
      toolbar: false,
      panel: ['actions'],
    });
    expect(stories[9]).toMatchObject({ toolbar: false });
    expect(stories[0]).not.toHaveProperty('toolbar');
  });

  it('explains invalid toolbar and panel values', () => {
    for (const value of ['{items}', '{1}', '"viewport"', "{['viewport']}", "{['zoom']}"]) {
      expect(
        reject(asNamespaced(`<Story of={Button.Primary} toolbar=${value} />\n`)).message
      ).toContain('toolbar must be true, false, or [].');
    }
    expect(
      reject(asNamespaced("<Story of={Button.Primary} panel={['a11y']} />\n")).message
    ).toContain('panel does not allow "a11y".');
    expect(
      reject(asNamespaced("<Story of={Button.Primary} panel={['actions', 'actions']} />\n")).message
    ).toContain('panel lists "actions" more than once.');
    expect(reject(asNamespaced('<Story of={Button.Primary} panel="true" />\n')).message).toContain(
      'panel must be true, false, or a static array of "actions" and "interactions".'
    );
    expect(reject(asNamespaced('<Story of={Button.Primary} panel={items} />\n')).message).toContain(
      'panel must be true, false, or a static array of "actions" and "interactions".'
    );
    expect(
      reject(asNamespaced('<Story of={Button.Primary} panels={["controls"]} />\n')).message
    ).toContain('Use panel.');
    expect(
      reject(asNamespaced("<Story of={Button.Primary} toolbar={[]} toolbar={['viewport']} />\n"))
        .message
    ).toContain('<Story> has more than one toolbar attribute.');
  });

  it('publishes the manager-docs package subpath', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    ) as { name: string };
    expect(MANAGER_DOCS_MDX_SPECIFIER).toBe(`${pkg.name}/mdx`);
  });

  it('accepts the author alias on the namespaced story tag', () => {
    const page = parseManagerDocs(
      [
        `import * as MD from '${MANAGER_DOCS_MDX_SPECIFIER}';`,
        "import * as ButtonStories from './Button.stories';",
        '',
        '<MD.Story of={ButtonStories.Primary} focus />',
        '',
      ].join('\n'),
      file
    );

    expect(page.imports.map((statement) => statement.source)).toEqual(['./Button.stories']);
    expect(page.blocks[0]).toMatchObject({
      type: 'story',
      moduleName: 'ButtonStories',
      exportName: 'Primary',
      focus: true,
    });
  });

  it('rejects a bare Story tag and tells the author to import the namespace', () => {
    const error = reject('<Story of={ButtonStories.Primary} />\n');
    expect(error.construct).toBe('story');
    expect(error.line).toBe(1);
    expect(error.column).toBe(1);
    expect(error.message).toContain(
      `'<Story>' is not valid. Import the namespace and use <Alias.Story>: import * as Alias from '${MANAGER_DOCS_MDX_SPECIFIER}'.`
    );
  });

  it('rejects a value import of Story from the mdx entry', () => {
    const named = reject(`import { Story } from '${MANAGER_DOCS_MDX_SPECIFIER}';\n`);
    expect(named.construct).toBe('import');
    expect(named.line).toBe(1);
    expect(named.column).toBe(1);
    expect(named.message).toContain(
      `'<Story>' is used as <Alias.Story> after import * as Alias from '${MANAGER_DOCS_MDX_SPECIFIER}'.`
    );

    const renamed = reject(`import { Story as Block } from '${MANAGER_DOCS_MDX_SPECIFIER}';\n`);
    expect(renamed.message).toContain(
      `'<Story>' is used as <Alias.Story> after import * as Alias from '${MANAGER_DOCS_MDX_SPECIFIER}'.`
    );

    const typed = reject(`import type { Story } from '${MANAGER_DOCS_MDX_SPECIFIER}';\n`);
    expect(typed.construct).toBe('import');
    expect(typed.message).toContain('Type imports are not allowed.');
  });

  it('rejects a second namespace alias, a typo, and any other member', () => {
    const second = reject(
      [
        `import * as SB from '${MANAGER_DOCS_MDX_SPECIFIER}';`,
        `import * as MD from '${MANAGER_DOCS_MDX_SPECIFIER}';`,
        '',
      ].join('\n')
    );
    expect(second.construct).toBe('import');
    expect(second.line).toBe(2);
    expect(second.column).toBe(1);
    expect(second.message).toContain(
      `Only one namespace import from '${MANAGER_DOCS_MDX_SPECIFIER}' is allowed.`
    );

    const typo = reject(
      [
        `import * as SB from '${MANAGER_DOCS_MDX_SPECIFIER}';`,
        '<SB.Stroy of={ButtonStories.Primary} />',
        '',
      ].join('\n')
    );
    expect(typo.construct).toBe('component');
    expect(typo.line).toBe(2);
    expect(typo.column).toBe(1);
    expect(typo.message).toContain('<SB.Story>');

    const other = reject(
      [`import * as SB from '${MANAGER_DOCS_MDX_SPECIFIER}';`, '<SB.Canvas />', ''].join('\n')
    );
    expect(other.construct).toBe('component');
    expect(other.line).toBe(2);
    expect(other.message).toContain('<SB.Canvas>');
    expect(other.message).toContain('<SB.Story>');

    const mismatch = reject(
      [
        `import * as SB from '${MANAGER_DOCS_MDX_SPECIFIER}';`,
        '<MD.Story of={ButtonStories.Primary} />',
        '',
      ].join('\n')
    );
    expect(mismatch.construct).toBe('story');
    expect(mismatch.line).toBe(2);
    expect(mismatch.message).toContain('does not match "SB"');
  });

  it('keeps a pipe inside a table code span in that cell', () => {
    const page = parseManagerDocs(
      ['| A | B |', '| --- | --- |', '| `a|b` | c |', ''].join('\n'),
      file
    );

    expect(page.blocks[0]).toMatchObject({
      type: 'table',
      header: [[{ type: 'text', value: 'A' }], [{ type: 'text', value: 'B' }]],
      rows: [[[{ type: 'inlineCode', value: 'a|b' }], [{ type: 'text', value: 'c' }]]],
    });
  });
});

describe('component blocks', () => {
  const docsFile = './src/docs/Guide.mdx';
  const head = [
    `import * as SB from '${MANAGER_DOCS_MDX_SPECIFIER}';`,
    "import * as CardStories from './Card.stories';",
    "import { DocsCallout } from '../components/DocsCallout';",
    "import Banner, { Tip as Hint } from '@acme/ui';",
    '',
  ].join('\n');

  function rejectComponent(body: string): ManagerDocsParseError {
    try {
      parseManagerDocs(`${head}${body}`, docsFile);
    } catch (error) {
      expect(error).toBeInstanceOf(ManagerDocsParseError);
      return error as ManagerDocsParseError;
    }
    throw new Error('expected a parse error');
  }

  it('parses a component between markdown and a story', () => {
    const page = parseManagerDocs(
      [
        head,
        '## Note',
        '',
        '<DocsCallout tone="warning" size={480} dense={true} label={"quoted"} compact>',
        '  be',
        '  careful',
        '</DocsCallout>',
        '',
        '<SB.Story of={CardStories.Default} />',
        '',
      ].join('\n'),
      docsFile
    );

    expect(page.imports.map((statement) => statement.source)).toEqual(['./Card.stories']);
    expect(page.blocks).toEqual([
      { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Note' }] },
      {
        type: 'component',
        blockId: './src/components/DocsCallout#DocsCallout',
        importSource: '../components/DocsCallout',
        exportName: 'DocsCallout',
        props: { tone: 'warning', size: 480, dense: true, label: 'quoted', compact: true },
        children: 'be careful',
        position: { line: 8, column: 1 },
      },
      {
        type: 'story',
        moduleName: 'CardStories',
        exportName: 'Default',
        focus: false,
        position: { line: 13, column: 1 },
      },
    ]);
  });

  it('resolves default and renamed package imports to their export', () => {
    const page = parseManagerDocs(`${head}<Banner />\n\n<Hint text='hi' />\n`, docsFile);

    expect(page.blocks).toMatchObject([
      { type: 'component', blockId: '@acme/ui#default', exportName: 'default', props: {} },
      { type: 'component', blockId: '@acme/ui#Tip', exportName: 'Tip', props: { text: 'hi' } },
    ]);
    expect(page.blocks[0]).not.toHaveProperty('children');
  });

  it('gives every page that imports one component the same block id', () => {
    const fromRoot = parseManagerDocs(
      "import { DocsCallout } from './src/components/DocsCallout';\n\n<DocsCallout />\n",
      './Intro.mdx'
    );

    expect(fromRoot.blocks[0]).toMatchObject({
      blockId: './src/components/DocsCallout#DocsCallout',
    });
  });

  it.each([
    ['an expression prop', '<DocsCallout tone={tone} />\n', 'component-prop', 5, 14],
    ['a template literal prop', '<DocsCallout tone={`x`} />\n', 'component-prop', 5, 14],
    ['an object prop', '<DocsCallout style={{ a: 1 }} />\n', 'component-prop', 5, 14],
    ['a spread', '<DocsCallout {...props} />\n', 'component-prop', 5, 14],
    ['a children prop', '<DocsCallout children="x" />\n', 'component-prop', 5, 14],
    ['a repeated prop', '<DocsCallout tone="a" tone="b" />\n', 'component-prop', 5, 23],
    ['an unclosed string', '<DocsCallout tone="a />\n', 'component-prop', 5, 14],
    ['a missing close', '<DocsCallout tone="a">text\n', 'component', 5, 1],
    ['a nested component', '<DocsCallout><Hint /></DocsCallout>\n', 'component', 5, 14],
    ['nested html', '<DocsCallout>a <b>b</b></DocsCallout>\n', 'component', 5, 16],
    ['markdown children', '<DocsCallout>**bold**</DocsCallout>\n', 'component', 5, 14],
    ['an expression child', '<DocsCallout>{count}</DocsCallout>\n', 'expression', 5, 14],
    ['trailing content', '<DocsCallout /> and more\n', 'component', 5, 17],
    ['a component in a list', '- <DocsCallout />\n', 'component', 5, 3],
    ['a component in a blockquote', '> <DocsCallout />\n', 'component', 5, 3],
    ['a component inside prose', 'See <DocsCallout /> here.\n', 'component', 5, 5],
    ['an unimported component', '<Missing />\n', 'component', 5, 1],
    ['a bare story', '<Story of={CardStories.Default} />\n', 'story', 5, 1],
  ])('rejects %s', (_name, body, construct, line, column) => {
    const error = rejectComponent(body);

    expect(error.construct).toBe(construct);
    expect(error.line).toBe(line);
    expect(error.column).toBe(column);
  });
});
