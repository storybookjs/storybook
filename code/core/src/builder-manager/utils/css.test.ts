import { runInNewContext } from 'node:vm';

import { join } from 'pathe';
import { build } from 'rolldown';
import { expect, it } from 'vitest';

import { cssAsStyleElement } from './css.ts';

// Rolldown reads the real file system, so the stylesheets are committed.
const entry = join(import.meta.dirname, '__testfixtures__/css/entry.js');

it('adds each stylesheet as a style element, in import order and with its assets inlined', async () => {
  const { output } = await build({
    input: entry,
    write: false,
    logLevel: 'silent',
    // The fixtures are inside this package, whose package.json sets `sideEffects: false`.
    treeshake: { moduleSideEffects: [{ test: /./, sideEffects: true }] },
    moduleTypes: { '.svg': 'dataurl' },
    plugins: [cssAsStyleElement()],
    output: { format: 'iife' },
  });

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


    .panel {
      background: url("data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"1\\" height=\\"1\\"/>%0A");
      mask: url('#mask');
    }
    ",
    ]
  `);
});
