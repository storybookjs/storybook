#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join, normalize } from 'pathe';

const [outDir, ...runIds] = process.argv.slice(2);
if (!outDir || runIds.length === 0) {
  console.error('Usage: node fetch-runs.mjs <out-dir> <run-id>...');
  process.exit(2);
}
const invalid = runIds.filter((id) => !/^\d+$/.test(id));
if (invalid.length > 0) {
  console.error(`A run id is digits only: ${invalid.join(', ')}`);
  process.exit(2);
}

// gh extracts each artifact into its own directory, and each artifact holds <repo>/<os>/<engine>.
for (const runId of runIds) {
  const download = mkdtempSync(join(tmpdir(), `qa-run-${runId}-`));
  try {
    execFileSync('gh', ['run', 'download', runId, '--pattern', 'qa-result-*', '--dir', download], {
      stdio: 'inherit',
    });
    for (const path of readdirSync(download, { recursive: true }).map(normalize)) {
      const [artifact, repo, os, engine, file, ...deeper] = path.split('/');
      if (file !== 'result.json' || deeper.length > 0) {
        continue;
      }
      const target = join(outDir, repo, os, engine);
      rmSync(target, { recursive: true, force: true });
      cpSync(join(download, artifact, repo, os, engine), target, { recursive: true });
      console.log(`${repo} ${os} ${engine} from run ${runId}`);
    }
  } finally {
    rmSync(download, { recursive: true, force: true });
  }
}
