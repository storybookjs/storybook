import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';

import { join } from 'pathe';
import { build } from 'rolldown';
import { expect, it } from 'vitest';

import { cssAsStyleElement } from './css.ts';

// Rolldown reads the real file system, so the stylesheets are committed.
const fixture = (name: string) => join(import.meta.dirname, '../__testfixtures__/css', name);

const bundleEntry = (input: string) =>
  build({
    input,
    write: false,
    logLevel: 'silent',
    treeshake: false,
    moduleTypes: { '.svg': 'dataurl' },
    plugins: [cssAsStyleElement()],
    output: { format: 'iife', name: 'entry' },
  });

const document = () => ({
  createElement: () => ({}),
  head: { append: () => {} },
});

// The text of each style element that the bundle of `input` adds, in order.
const stylesOf = async (input: string) => {
  const { output } = await bundleEntry(input);
  const styles: string[] = [];
  runInNewContext(output[0].code, {
    document: {
      createElement: () => ({}),
      head: { append: (style: { textContent: string }) => styles.push(style.textContent) },
    },
  });
  return styles;
};

it('adds a stylesheet as one style element, with its imports in place and its assets inlined', async () => {
  expect(await stylesOf(fixture('entry.js'))).toMatchInlineSnapshot(`
    [
      "@import 'https://fonts.example/font.css';
    .other {
      color: red;
    }


    /* A comment with a url(./missing.png) in it */
    .panel {
      background: url("data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"1\\" height=\\"1\\"/>%0A");
      mask: url('#mask');
    }

    .panel::after {
      content: 'a string with a url(./missing.png) and a /* in it';
      background: url("data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"1\\" height=\\"1\\"/>%0A");
    }
    ",
    ]
  `);
});

// The styles of files that are written here, because the formatter would normalize what they are
// about. `entry.css` is the stylesheet that the script imports.
const stylesOfFiles = async (files: Record<string, string>) => {
  const directory = await mkdtemp(join(tmpdir(), 'sb-manager-css-'));
  const all = {
    'entry.js': `import './entry.css';`,
    'other.css': '.other { color: red; }',
    ...files,
  };
  await Promise.all(
    Object.entries(all).map(([name, content]) => writeFile(join(directory, name), content))
  );
  try {
    return await stylesOf(join(directory, 'entry.js'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
// The start of the `url()` that `svg` becomes.
const pixel = `url("data:image/svg+xml,${svg.replaceAll('"', '\\"')}`;

it('reads a byte order mark, an @import without a semicolon and every form of url()', async () => {
  const styles = await stylesOfFiles({
    'entry.js': `import './bom.css';\nimport './last-import.css';\nimport './urls.css';`,
    'bom.css': '\uFEFF@charset "UTF-8";\r\n.first { color: red; }\r\n',
    'last-import.css': '@import "./other.css"',
    'urls.css': [
      '.spaces { background: url( ./pixel.svg ); }',
      '.parentheses { background: url("./pixel (1).svg"); }',
      `.fragment { background: url('./pixel.svg#icon'); }`,
      '.query { background: url(./pixel.svg?#iefix); }',
    ].join('\n'),
    'pixel.svg': svg,
    'pixel (1).svg': svg,
  });

  expect(styles).toEqual([
    '@charset "UTF-8";\r\n.first { color: red; }\r\n',
    '.other { color: red; }',
    [
      `.spaces { background: ${pixel}"); }`,
      `.parentheses { background: ${pixel}"); }`,
      `.fragment { background: ${pixel}#icon"); }`,
      `.query { background: ${pixel}"); }`,
    ].join('\n'),
  ]);
});

it('reads an @import without a space, as a minifier writes it, and a path with an escape', async () => {
  const styles = await stylesOfFiles({
    'entry.css': String.raw`@import"./other.css";.a{background:url(./a\ b.svg)}.b{background:url("./a\20 b.svg")}`,
    'a b.svg': svg,
  });

  expect(styles).toEqual([
    `.other { color: red; }.a{background:${pixel}")}.b{background:${pixel}")}`,
  ]);
});

it('rejects a path that it cannot read, which the browser would look for next to the page', async () => {
  await expect(
    stylesOfFiles({ 'entry.css': '.a { background: url(./a b.svg); }' })
  ).rejects.toThrow('Could not read url(./a b.svg); }');
});

it('leaves a URL that it cannot read and that names no file', async () => {
  const css = [
    `.a { background: url(data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>); }`,
    String.raw`.b { background: url("data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\"/>"); }`,
    '.c { background: url(); }',
  ].join('\n');

  expect(await stylesOfFiles({ 'entry.css': css })).toEqual([css]);
});

const fonts = `@import url('https://fonts.example/css2?family=Inter:wght@400;700');`;

it('inlines an @import after one of a URL that holds a semicolon', async () => {
  expect(await stylesOfFiles({ 'entry.css': `${fonts}\n@import './other.css';` })).toEqual([
    `${fonts}\n.other { color: red; }`,
  ]);
});

it('starts a style element at an @import of a URL that follows a stylesheet', async () => {
  const styles = await stylesOfFiles({
    'entry.css': `@import './other.css';\n@import './fonts.css';\n.rule { color: blue; }`,
    'fonts.css': `${fonts}\n.fonts { color: green; }`,
  });

  expect(styles).toEqual([
    '.other { color: red; }\n',
    `${fonts}\n.fonts { color: green; }\n.rule { color: blue; }`,
  ]);
});

it('rejects an @import of a URL in a stylesheet that is imported with a condition', async () => {
  const styles = stylesOfFiles({
    'entry.css': `@import './fonts.css' print;`,
    'fonts.css': fonts,
  });

  await expect(styles).rejects.toThrow('is imported with a condition');
});

it('reads a supports() condition with nested parentheses', async () => {
  const condition = '((display: grid) and (not (display: inline-grid)))';

  expect(
    await stylesOfFiles({ 'entry.css': `@import './other.css' supports${condition};` })
  ).toEqual([`@supports ${condition} {\n.other { color: red; }}\n`]);
});

it('keeps a layer order that is declared before an @import', async () => {
  expect(await stylesOf(fixture('import-after-layer.js'))).toMatchInlineSnapshot(`
    [
      "@layer one, two;
    .other {
      color: red;
    }

    ",
    ]
  `);
});

it('leaves an @import after a rule for the browser to ignore, as esbuild did', async () => {
  expect(await stylesOf(fixture('import-after-rule.js'))).toMatchInlineSnapshot(`
    [
      ".rule {
      color: blue;
    }
    @import './other.css';
    ",
    ]
  `);
});

it('wraps a stylesheet that is imported with a condition in that condition', async () => {
  expect(await stylesOf(fixture('conditional.js'))).toMatchInlineSnapshot(`
    [
      "@media print {
    .other {
      color: red;
    }
    }

    ",
    ]
  `);
});

it('repeats a stylesheet at each of its imports, so the last one wins as in CSS', async () => {
  expect(await stylesOf(fixture('repeat.js'))).toMatchInlineSnapshot(`
    [
      ".shared {
      color: red;
    }

    .shared {
      color: green;
    }
    ",
      ".shared {
      color: red;
    }

    ",
    ]
  `);
});

it('breaks a cycle of imports', async () => {
  expect(await stylesOf(fixture('cycle.js'))).toMatchInlineSnapshot(`
    [
      "
    .b {
      color: blue;
    }

    .a {
      color: red;
    }
    ",
    ]
  `);
});

it('gives a stylesheet an empty default export, as esbuild did', async () => {
  const { output } = await bundleEntry(fixture('default-import.js'));

  const context = { document: document(), entry: undefined };
  runInNewContext(output[0].code, context);

  expect(context.entry).toEqual({});
});

it('rejects a CSS module, whose class names it cannot provide', async () => {
  await expect(bundleEntry(fixture('css-module.js'))).rejects.toThrow(
    'CSS modules cannot be bundled into the manager'
  );
});
