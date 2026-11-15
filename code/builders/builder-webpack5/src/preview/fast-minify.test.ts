import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { fastMinify } from './fast-minify.ts';

// A chunk as webpack writes it for `output.library`: a script, whose top-level `var` is a global.
const chunk = `var library;
(() => {
  "use strict";
  library = { strict: (function () { return this === undefined; })() };
})();`;

describe.each(['main.iframe.bundle.js', 'main.iframe.bundle.js?v=1a2b3c4d'])(
  'the fast minifier, for the asset %s',
  (fileName) => {
    it('keeps the globals and the strict mode of a script', async () => {
      const { code, errors } = await fastMinify({ [fileName]: chunk }, undefined, {});

      const page: { library?: { strict: boolean } } = {};
      runInNewContext(code, page);

      expect(errors).toEqual([]);
      expect(page.library).toEqual({ strict: true });
    });

    it('names the asset as the source of its source map', async () => {
      const { map } = await fastMinify({ [fileName]: chunk }, {}, {});

      expect(map?.sources).toEqual([fileName]);
    });
  }
);
