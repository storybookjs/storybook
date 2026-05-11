#!/usr/bin/env node
// Strip lifecycle scripts from every workspace package.json under $1.
// BLOCKER #3 hardening:
//  - skip symlinks
//  - try/catch around JSON.parse (warn + skip on malformed)
//  - max-depth 8
//  - per-file size cap 1 MB (defuses OOM via 4 GB package.json)
//  - 60 s overall timeout via setTimeout + process.exit
//  - prototype-chain hygiene (Object.hasOwn)
//  - skip dirs: node_modules, .yarn, anything starting with `.git`

import * as fs from 'node:fs';
import * as path from 'node:path';

// CLI: strip-lifecycle-scripts.mjs <root> [--packageManager <value|EMPTY>]
const args = process.argv.slice(2);
const root = args[0];
if (!root) {
  console.error('usage: strip-lifecycle-scripts.mjs <root> [--packageManager <value|EMPTY>]');
  process.exit(1);
}
const pmIdx = args.indexOf('--packageManager');
const basePackageManager = pmIdx >= 0 ? args[pmIdx + 1] : null;
const rootPkgPath = path.join(root, 'package.json');

const SKIPS = ['preinstall', 'install', 'postinstall', 'prepare'];
const MAX_DEPTH = 8;
const MAX_FILE_BYTES = 1_000_000;
const SKIP_DIRS = new Set(['node_modules', '.yarn']);

// 60 s wall-clock timeout — defuses pathological loops / link cycles.
const timeoutHandle = setTimeout(() => {
  console.error('::error::strip-lifecycle-scripts.mjs timed out after 60 s');
  process.exit(1);
}, 60_000);
timeoutHandle.unref();

function walk(dir, depth) {
  if (depth > MAX_DEPTH) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.warn('::warning::skipped unreadable dir', dir, String(err));
    return;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.git')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, depth + 1);
      continue;
    }
    if (entry.name !== 'package.json') continue;

    let stat;
    try {
      stat = fs.statSync(p);
    } catch (err) {
      console.warn('::warning::skipped unreadable file', p, String(err));
      continue;
    }
    if (stat.size > MAX_FILE_BYTES) {
      console.warn('::warning::skipped oversized package.json', p, stat.size);
      continue;
    }

    let json;
    try {
      json = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (err) {
      console.warn('::warning::skipped malformed', p, String(err));
      continue;
    }

    // Prototype-chain hygiene — refuse to act on inherited / null scripts.
    if (!Object.hasOwn(json, 'scripts') || json.scripts === null || typeof json.scripts !== 'object') {
      continue;
    }

    let lifecycleTouched = false;
    for (const s of SKIPS) {
      if (Object.hasOwn(json.scripts, s)) {
        delete json.scripts[s];
        lifecycleTouched = true;
      }
    }

    // BLOCKER (iter-4 F-3.1) — packageManager normalisation, single hardened
    // pass. Applied ONLY to the root pr-head/package.json. The walker already
    // lstat'd + size-capped + try/catch'd this file above; no asymmetry.
    let pmTouched = false;
    if (basePackageManager !== null && p === rootPkgPath) {
      if (basePackageManager === 'EMPTY') {
        if (Object.hasOwn(json, 'packageManager')) {
          delete json.packageManager;
          pmTouched = true;
        }
      } else if (json.packageManager !== basePackageManager) {
        json.packageManager = basePackageManager;
        pmTouched = true;
      }
    }

    if (lifecycleTouched || pmTouched) {
      fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
      if (lifecycleTouched) console.log('[harden] stripped lifecycle scripts:', p);
      if (pmTouched) console.log('[harden] packageManager normalised in', p, '→', basePackageManager);
    }
  }
}

walk(root, 0);
clearTimeout(timeoutHandle);
