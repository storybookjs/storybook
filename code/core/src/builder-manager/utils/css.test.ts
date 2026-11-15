import { runInNewContext } from 'node:vm';

import { join } from 'pathe';
import { build } from 'rolldown';
import { expect, it } from 'vitest';

import { keepEveryModule } from './bundle.ts';
import { cssAsStyleElement } from './css.ts';

// Rolldown reads the real file system, so the stylesheets are committed.
const entry = join(import.meta.dirname, '../__testfixtures__/css/entry.js');

const bundleEntry = (input: string) =>
  build({
    input,
    write: false,
    logLevel: 'silent',
    treeshake: keepEveryModule,
    moduleTypes: { '.svg': 'dataurl' },
    plugins: [cssAsStyleElement()],
    output: { format: 'iife' },
  });

it('adds each stylesheet as a style element, in import order and with its assets inlined', async () => {
  const { output } = await bundleEntry(entry);

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
    ",
    ]
  `);
});

it('rejects a local @import with a condition, which a style element cannot express', async () => {
  await expect(
    bundleEntry(join(import.meta.dirname, '../__testfixtures__/css/conditional.js'))
  ).rejects.toThrow('An @import with a condition cannot be bundled into the manager');
});
