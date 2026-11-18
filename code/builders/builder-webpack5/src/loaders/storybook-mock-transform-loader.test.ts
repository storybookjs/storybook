import { describe, expect, it } from 'vitest';

import { resolve } from 'node:path';

import MagicString from 'magic-string';
import { dedent } from 'ts-dedent';

import loader from './storybook-mock-transform-loader.ts';

type IncomingMap = Parameters<typeof loader>[1];

const id = resolve('/project/.storybook/preview.ts');

const transpileLikeAnEarlierLoader = (code: string) => {
  const edited = new MagicString(code).remove(0, code.indexOf('\n') + 2);
  return {
    code: edited.toString(),
    map: {
      ...edited.generateMap({ hires: 'boundary', source: id }),
      file: id,
      sourcesContent: [code],
    },
  };
};

const run = (content: string, map: IncomingMap) =>
  new Promise<{ code: string; map: unknown }>((done, fail) => {
    const context = {
      async: () => (error: Error | null, code: string, result: unknown) =>
        error ? fail(error) : done({ code, map: result }),
      resourcePath: id,
    } as unknown as ThisParameterType<typeof loader>;
    loader.call(context, content, map);
  });

describe('storybook mock transform loader', () => {
  it('maps the rewrite through the incoming source map', async () => {
    const originalCode = dedent`
      import type { Preview } from '@storybook/react';

      sb.mock(import('./bar/baz'), { spy: true });
    `;
    const transpiled = transpileLikeAnEarlierLoader(originalCode);

    const result = await run(transpiled.code, transpiled.map);

    expect(result.code).toBe(`sb.mock("./bar/baz", { spy: true });`);
    expect(result.map).toMatchObject({
      file: id,
      sources: transpiled.map.sources,
      sourcesContent: [originalCode],
    });
  });

  it('passes the incoming source map on when nothing is rewritten', async () => {
    const transpiled = transpileLikeAnEarlierLoader(
      `import type { Preview } from '@storybook/react';\n\nexport default {};\n`
    );

    const result = await run(transpiled.code, transpiled.map);

    expect(result.code).toBe(transpiled.code);
    expect(result.map).toBe(transpiled.map);
  });
});
