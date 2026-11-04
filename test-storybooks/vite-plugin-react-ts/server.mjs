import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { createServer } from 'vite';

const ROOT = import.meta.dirname;
const PORT = Number(process.env.PORT ?? 5176);
const httpServer = http.createServer();
const vite = await createServer({
  root: ROOT,
  configFile: path.join(ROOT, 'vite.config.ts'),
  appType: 'custom',
  server: { middlewareMode: true, hmr: { server: httpServer } },
});

httpServer.on('request', (req, res) => {
  vite.middlewares(req, res, async () => {
    if (req.url === '/' || req.url === '/index.html') {
      const html = await vite.transformIndexHtml(
        req.url,
        await readFile(path.join(ROOT, 'index.html'), 'utf8')
      );
      res.setHeader('Content-Type', 'text/html');
      res.end(html);
      return;
    }

    res.statusCode = 404;
    res.end();
  });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`middleware host listening on http://127.0.0.1:${PORT}`);
});
