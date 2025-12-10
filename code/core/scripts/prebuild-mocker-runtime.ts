import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSync } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Paths
const templatePath = join(__dirname, '..', 'assets', 'server', 'mocker-runtime.template.js');
const outputDir = join(__dirname, '..', 'assets', 'server');
const outputPath = join(outputDir, 'mocker-runtime.bundled.js');

console.log('Pre-building mocker runtime...');

// Try to bundle with @vitest/mocker dependencies
const result = buildSync({
  entryPoints: [templatePath],
  bundle: true,
  write: false,
  format: 'esm',
  target: 'es2020',
  external: ['msw/browser', 'msw/core/http'],
  // Important: resolve from the workspace root where dependencies are hoisted
  absWorkingDir: join(__dirname, '..', '..', '..', '..'),
});

// Ensure output directory exists
mkdirSync(outputDir, { recursive: true });

// Write the bundled runtime
writeFileSync(outputPath, result.outputFiles[0].text, 'utf-8');
console.log(`✓ Mocker runtime bundled successfully (${result.outputFiles[0].text.length} bytes)`);
console.log(`  Output: ${outputPath}`);
