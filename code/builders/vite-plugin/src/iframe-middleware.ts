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

      // Transform config placeholders and rewrite the virtual module URL.
      // In dev mode this produces /@id/__x00__virtual:... which we then
      // rewrite to /@storybook-env/virtual:... for environment routing.
      let transformed = await transformIframeHtml(rawHtml, options);

      // Route the virtual module through the storybook environment.
      const envPrefix = getStorybookModulePrefix();
      transformed = transformed.replace(
        `/@id/__x00__${SB_VIRTUAL_FILES.VIRTUAL_APP_FILE}`,
        `${envPrefix}/${SB_VIRTUAL_FILES.VIRTUAL_APP_FILE}`
      );

      // Run Vite's transformIndexHtml pipeline to inject @vite/client
      // and run remaining hooks (channel path patching).
      const finalHtml = await server.transformIndexHtml(iframePath, transformed);

      res.setHeader('Content-Type', 'text/html');
      res.statusCode = 200;
      res.write(finalHtml);
      res.end();
    } catch (error) {
      next(error);
    }
  };
}
