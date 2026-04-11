import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { Options } from 'storybook/internal/types';

import type { Connect, ViteDevServer } from 'vite';

import { transformIframeHtml } from '../../builder-vite/src/transform-iframe-html';
import { SB_VIRTUAL_FILES } from '../../builder-vite/src/virtual-file-names';
import { getStorybookModulePrefix } from './environment-module-router';

export function createIframeMiddleware(
  options: Options,
  server: ViteDevServer,
  basePath: string
): Connect.NextHandleFunction {
  const iframePath = `${basePath}iframe.html`;

  return async (req, res, next) => {
    const pathname = req.url?.split('?')[0];
    if (pathname !== iframePath) {
      return next();
    }

    try {
      const templatePath = fileURLToPath(
        import.meta.resolve('@storybook/builder-vite/input/iframe.html')
      );
      const rawHtml = await readFile(templatePath, { encoding: 'utf8' });

      // Transform config placeholders. In dev mode this produces the script src
      // as `/@id/__x00__virtual:/@storybook/builder-vite/vite-app.js`.
      let transformed = await transformIframeHtml(rawHtml, options);

      // Stash the storybook preview's <script> tag out of the html before
      // running `server.transformIndexHtml`. Vite's transformIndexHtml pipeline
      // pre-transforms `<script type="module" src>` tags via the *client*
      // environment's plugin container, which does not have the storybook-env
      // plugins — so resolving a `/@storybook-env/...` src would fail with
      // `Pre-transform error: Failed to load url /@storybook-env/...`.
      //
      // Removing the tag, letting Vite run its pipeline (which still injects
      // @vite/client and any global `transformIndexHtml` hooks), and appending
      // the real tag at the end avoids that dead-end pre-transform while
      // keeping all other html processing intact.
      const envPrefix = getStorybookModulePrefix();
      const storybookAppSrc = `${envPrefix}/${SB_VIRTUAL_FILES.VIRTUAL_APP_FILE}`;
      const APP_SCRIPT_PLACEHOLDER = '<!--__STORYBOOK_APP_SCRIPT__-->';
      const appScriptMatch = transformed.match(
        /<script\s+[^>]*src="\/@id\/__x00__virtual:\/@storybook\/builder-vite\/vite-app\.js"[^>]*><\/script>/
      );
      const appScriptTag = appScriptMatch
        ? appScriptMatch[0].replace(
            /src="\/@id\/__x00__virtual:\/@storybook\/builder-vite\/vite-app\.js"/,
            `src="${storybookAppSrc}"`
          )
        : `<script type="module" src="${storybookAppSrc}"></script>`;
      if (appScriptMatch) {
        transformed = transformed.replace(appScriptMatch[0], APP_SCRIPT_PLACEHOLDER);
      }

      // Run Vite's transformIndexHtml pipeline to inject @vite/client
      // and run remaining hooks (channel path patching).
      const transformedByVite = await server.transformIndexHtml(iframePath, transformed);
      const finalHtml = transformedByVite.replace(APP_SCRIPT_PLACEHOLDER, appScriptTag);

      res.setHeader('Content-Type', 'text/html');
      res.statusCode = 200;
      res.write(finalHtml);
      res.end();
    } catch (error) {
      next(error);
    }
  };
}
