import { runInNewContext } from 'node:vm';

import { join } from 'pathe';
import { build } from 'rolldown';
import { expect, it } from 'vitest';

import { keepEveryModule } from './bundle.ts';
import { cssAsStyleElement } from './css.ts';

// Rolldown reads the real file system, so the stylesheets are committed.
const fixture = (name: string) => join(import.meta.dirname, '../__testfixtures__/css', name);

const bundleEntry = (input: string) =>
  build({
    input,
    write: false,
    logLevel: 'silent',
    treeshake: keepEveryModule,
    moduleTypes: { '.svg': 'dataurl' },
    plugins: [cssAsStyleElement()],
    output: { format: 'iife', name: 'entry' },
  });

const document = () => ({
  createElement: () => ({}),
  head: { append: () => {} },
});

it('adds each stylesheet as a style element, in import order and with its assets inlined', async () => {
  const { output } = await bundleEntry(fixture('entry.js'));

  const styles: string[] = [];
  runInNewContext(output[0].code, {
    document: {
      createElement: () => ({}),
      head: { append: (style: { textContent: string }) => styles.push(style.textContent) },
    },
  });

  expect(styles).toMatchInlineSnapshot(`
    [
      ".other {
      color: red;
    }
    ",
      "@import 'https://fonts.example/font.css';


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

it('gives a stylesheet an empty default export, as esbuild did', async () => {
  const { output } = await bundleEntry(fixture('default-import.js'));

  const context = { document: document(), entry: undefined };
  runInNewContext(output[0].code, context);

  expect(context.entry).toEqual({});
});

it('rejects a local @import with a condition, which a style element cannot express', async () => {
  await expect(bundleEntry(fixture('conditional.js'))).rejects.toThrow(
    'An @import with a condition cannot be bundled into the manager'
  );
});

it('rejects a CSS module, whose class names it cannot provide', async () => {
  await expect(bundleEntry(fixture('css-module.js'))).rejects.toThrow(
    'CSS modules cannot be bundled into the manager'
  );
});
