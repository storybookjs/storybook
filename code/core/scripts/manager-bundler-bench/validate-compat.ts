/**
 * Checks what an addon author can rely on in a manager entry: each fixture is bundled as a manager
 * entry by each builder, loaded the way the manager page loads it (linked stylesheets, module
 * scripts), and the browser reports what it observed. A fixture whose observation differs from
 * esbuild's is a behaviour change for addon authors.
 *
 * Run from `code/`: `node core/scripts/manager-bundler-bench/validate-compat.ts <report.json> [--pr-core-dir <dir>]`
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { parseArgs } from 'node:util';

import { chromium } from 'playwright';

import type { Input } from './worker.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { 'pr-core-dir': { type: 'string' } },
});

const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const report = 'globalThis.__compat';
const probe = (className: string) =>
  `const el = document.createElement('div'); el.className = ${className}; document.body.appendChild(el); const cs = getComputedStyle(el);`;
const rootVar = (name: string) =>
  `getComputedStyle(document.documentElement).getPropertyValue('${name}').trim()`;

/** Files of the fixture project, by path. A `Buffer` is written as is. */
const files: Record<string, string | Buffer> = {
  'package.json': '{ "name": "compat-fixtures", "private": true }',
  // CSS
  'css/plain.css': ':root { --plain: yes; }',
  'css-plain.js': `import './css/plain.css'; ${report} = { plain: ${rootVar('--plain')} };`,
  'css/main.css': '@import "./dep.css";\n:root { --main: yes; }',
  'css/dep.css': ':root { --dep: yes; }',
  'css-import.js': `import './css/main.css'; ${report} = { main: ${rootVar('--main')}, dep: ${rootVar('--dep')} };`,
  'css/pixel.png': Buffer.from(PIXEL, 'base64'),
  'css/url.css': 'body { background-image: url("./pixel.png"); }',
  'css-url.js': `import './css/url.css'; ${report} = { background: getComputedStyle(document.body).backgroundImage.slice(0, 20) };`,
  'css/first.css': ':root { --order: first; }',
  'css/second.css': ':root { --order: second; }',
  'css-order.js': `import './css/first.css'; import './css/second.css'; ${report} = { order: ${rootVar('--order')} };`,
  'css/box.module.css': '.box { width: 123px; }',
  'css-modules.js': `import styles from './css/box.module.css'; ${probe('styles.box')} ${report} = { type: typeof styles.box, width: cs.width };`,
  'css-modules-named.js': `import { box } from './css/box.module.css'; ${probe('box')} ${report} = { type: typeof box, width: cs.width };`,
  'css/combo.module.css': '.base { height: 7px; }\n.combo { composes: base; width: 5px; }',
  'css-composes.js': `import styles from './css/combo.module.css'; ${probe('styles.combo')} ${report} = { width: cs.width, height: cs.height };`,
  // Syntax that a browser does not run as written
  'decorator.ts': `function tag(_value: unknown, _context: ClassMethodDecoratorContext) { return function () { return 'decorated'; }; }\nclass A { @tag m() { return 'plain'; } }\n(globalThis as any).__compat = { result: new A().m() };`,
  'accessor.ts': `class B { accessor x = 1; }\n(globalThis as any).__compat = { x: new B().x };`,
  'ns-merge.ts': `namespace N { export const x = 1; }\nnamespace N { export const y = x + 1; }\n(globalThis as any).__compat = { y: N.y };`,
  // Module semantics
  'node_modules/dual/package.json':
    '{ "name": "dual", "version": "1.0.0", "main": "index.cjs", "module": "index.mjs" }',
  'node_modules/dual/index.cjs': 'module.exports = function hello() { return "cjs"; };',
  'node_modules/dual/index.mjs': 'export default function hello() { return "esm"; }',
  'dual-require.js': `const dual = require('dual'); ${report} = { type: typeof dual };`,
  'cycle-a.js': `import { b } from './cycle-b.js'; const make = () => 'A' + (Date.now() % 1); export const a = make(); export const readB = () => b;`,
  'cycle-b.js': `import { a } from './cycle-a.js'; export const b = 'B:' + a;`,
  'const-cycle.js': `import { readB } from './cycle-a.js'; ${report} = { b: readB() };`,
  'node_modules/early/package.json': '{ "name": "early", "version": "1.0.0", "main": "index.js" }',
  'node_modules/early/index.js':
    'exports.before = 1;\nif (typeof window !== "undefined") {\n  return;\n}\nexports.after = 2;',
  'cjs-return.js': `import early from 'early'; ${report} = { keys: Object.keys(early).join(',') };`,
  'node_modules/umd/package.json': '{ "name": "umd", "version": "1.0.0", "main": "index.js" }',
  'node_modules/umd/index.js': `(function (root, factory) { if (typeof define === 'function' && define.amd) { define([], factory); } else if (typeof module === 'object' && module.exports) { module.exports = factory(); } else { root.umdLib = factory(); } })(typeof self !== 'undefined' ? self : this, function () { return { name: 'umd' }; });`,
  'umd.js': `import umd from 'umd'; ${report} = { viaImport: umd && umd.name, viaGlobal: typeof globalThis.umdLib };`,
};

const fixtures = Object.keys(files).filter(
  (file) => !file.includes('/') && file !== 'package.json' && !file.startsWith('cycle-')
);

const builders: Record<string, Pick<Input, 'bundler' | 'coreDir'>> = {
  esbuild: { bundler: 'esbuild' },
  rolldown: { bundler: 'rolldown' },
  ...(values['pr-core-dir'] && {
    pr37448: { bundler: 'external', coreDir: values['pr-core-dir'] },
  }),
};

const root = mkdtempSync(join(tmpdir(), 'sb-manager-compat-'));
for (const [file, content] of Object.entries(files)) {
  mkdirSync(dirname(join(root, 'fixtures', file)), { recursive: true });
  writeFileSync(join(root, 'fixtures', file), content);
}

const list = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
        item.isDirectory() ? list(join(dir, item.name)) : [join(dir, item.name)]
      )
    : [];

const CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.css': 'text/css',
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const rows: Record<string, Record<string, string>> = {};

for (const fixture of fixtures) {
  rows[fixture] = {};
  for (const [name, builder] of Object.entries(builders)) {
    const outputDir = join(root, 'out', name, fixture);
    mkdirSync(outputDir, { recursive: true });
    const inputFile = join(outputDir, 'input.json');
    const input: Input = {
      ...builder,
      mode: 'dev',
      entries: [join(root, 'fixtures', fixture)],
      envs: {},
      cacheKey: 'compat',
      outputDir,
    };
    writeFileSync(inputFile, JSON.stringify(input));
    const stdout = execFileSync(
      process.execPath,
      [join(import.meta.dirname, 'worker.ts'), inputFile],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    );
    const line = stdout.split('\n').find((text) => text.startsWith('__RESULT__')) ?? '';
    const result = JSON.parse(line.slice('__RESULT__'.length) || '{"error":"no result"}');
    if (result.error) {
      rows[fixture][name] = 'build fails';
      continue;
    }

    const built = list(join(outputDir, 'sb-addons')).map((file) => file.slice(outputDir.length));
    const html = `<!doctype html><link rel="icon" href="data:,">${built
      .filter((file) => file.endsWith('.css'))
      .map((file) => `<link rel="stylesheet" href="${file}">`)
      .join('')}<body>${built
      .filter((file) => file.endsWith('.js'))
      .map((file) => `<script type="module" src="${file}"></script>`)
      .join('')}</body>`;
    const server = createServer((request, response) => {
      const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      const body = path === '/' ? html : readFileSync(join(outputDir, path));
      response.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(path)] ?? 'text/html' });
      response.end(body);
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));

    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error.message)));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
    await page.waitForTimeout(400);
    const observed = await page.evaluate(() => (globalThis as any).__compat ?? null);
    const delivery = built.some((file) => file.endsWith('.css'))
      ? ' (stylesheet file)'
      : (await page.locator('style').count()) > 0
        ? ' (style element)'
        : '';
    rows[fixture][name] = observed
      ? JSON.stringify(observed) + delivery
      : `entry fails in the browser: ${errors[0]
          ?.replace(/^\[Storybook\][^ ]* One of your manager-entries failed: \S+ /, '')
          .split('\n')[0]
          .slice(0, 70)}`;
    await page.close();
    server.close();
  }
}
await browser.close();

writeFileSync(positionals[0], JSON.stringify(rows, null, 2));
for (const [fixture, results] of Object.entries(rows)) {
  const same = Object.values(results).every((value) => value === results.esbuild);
  process.stdout.write(`\n${fixture}${same ? '  (all the same)' : ''}\n`);
  for (const [name, value] of Object.entries(results)) {
    process.stdout.write(`  ${name.padEnd(9)} ${value}\n`);
  }
}
process.exit(0);
