import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { ViteDevServer } from 'vite';
import { transformIframeHtml } from '../../../builder-vite/src/transform-iframe-html';
import type { Options } from 'storybook/internal/types';
import { SB_VIRTUAL_FILES } from '../../../builder-vite/src/virtual-file-names';
import { getStorybookModulePrefix } from './module-router';

export function registerIframeMiddleware(
  server: ViteDevServer,
  options: Options,
  basePath: string = '/__storybook/'
) {
  const iframePath = `${basePath}iframe.html`;
  server.middlewares.use(async (req, res, next) => {
    if (!req.url?.startsWith(iframePath)) {
      return next();
    }
    const indexHtml = await readFile(
      fileURLToPath(import.meta.resolve('@storybook/builder-vite/input/iframe.html')),
      {
        encoding: 'utf8',
      }
    );
    let transformed = await transformIframeHtml(indexHtml, options);
    const envPrefix = getStorybookModulePrefix();
    const storybookAppSrc = `${envPrefix}/${SB_VIRTUAL_FILES.VIRTUAL_APP_FILE}`;
    const APP_SCRIPT_PLACEHOLDER = '<!--__STORYBOOK_APP_SCRIPT__-->';
    const appScriptMatch = transformed.match(
      /<script\s+[^>]*src="\/@id\/__x00__virtual:\/@storybook\/builder-vite\/vite-app\.js"[^>]*><\/script>/
    );
    const appScriptTag = appScriptMatch
      ? appScriptMatch[0].replace(
          /src="\/@id\/__x00__virtual:\/@storybook\/builder-vite\/vite-app\.js"/,
          `src="${envPrefix}/@id/__x00__virtual:/@storybook/builder-vite/vite-app.js"`
        )
      : `<script type="module" src="${storybookAppSrc}"></script>`;
    if (appScriptMatch) {
      transformed = transformed.replace(appScriptMatch[0], APP_SCRIPT_PLACEHOLDER);
    }

    const transformedByVite = await server.transformIndexHtml(iframePath, transformed);
    let finalHtml = transformedByVite.replace(APP_SCRIPT_PLACEHOLDER, appScriptTag);

    finalHtml = finalHtml.replace(
      /src="\/vite-inject-mocker-entry\.js"/,
      `src="${envPrefix}/vite-inject-mocker-entry.js"`
    );

    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.write(finalHtml);
    res.end();
  });
}
