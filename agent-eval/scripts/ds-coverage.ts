// Run the ds-coverage analyzer against a checked-out tree, for humans.
//
//   node scripts/ds-coverage.ts <dir> --ds '@base-ui/react' --ds '@droppy/*' [--json] [--per-file]
//
// The analyzer itself lives in lib/agentic-reference/metrics/ds-coverage/.
// This wrapper only parses arguments and renders tables.
// `--json` prints the full report for piping into jq.
//
// `--include <glob>` and `--exclude <glob>` select which files are counted;
// both repeat. Globs are picomatch patterns, written relative to <dir> or as
// an absolute path inside it. A file is counted when it matches at least one
// --include (every file when none is given) and matches no --exclude:
//
//   --exclude 'core/src/components/**'   everything but that directory
//   --include 'src/**'                   only that directory
//   --include 'src/**' --exclude 'src/debug/**'   that directory, less a corner
//
// A filtered-out file still resolves and is part of the module graph,
// but its own imports are not counted in the census.
import { statSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { analyzeDsCoverage } from '../lib/agentic-reference/metrics/ds-coverage/index.ts';

const USAGE =
  'usage: node scripts/ds-coverage.ts <dir> --ds <pattern> [--ds <pattern>...] ' +
  '[--include <glob>...] [--exclude <glob>...] [--nodes] [--json] [--per-file] [--top <n>]\n' +
  '       globs are relative to <dir>; counted files match any --include (all when none) and no --exclude';

const { values, positionals } = parseArgs({
  options: {
    ds: { type: 'string', multiple: true },
    include: { type: 'string', multiple: true },
    exclude: { type: 'string', multiple: true },
    nodes: { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    'per-file': { type: 'boolean', default: false },
    top: { type: 'string', default: '25' },
  },
  allowPositionals: true,
});

const dir = positionals[0];
const dsPackages = values.ds ?? [];
if (dir === undefined || dsPackages.length === 0) {
  console.error(USAGE);
  process.exit(2);
}
// A typo'd path would otherwise "analyze" an empty tree and report 0 files as
// if that were a measurement.
let isDirectory = false;
try {
  isDirectory = statSync(dir).isDirectory();
} catch {
  isDirectory = false;
}
if (!isDirectory) {
  console.error(`ds-coverage: not a directory: ${dir}`);
  process.exit(2);
}
const top = Number(values.top);
if (!Number.isInteger(top) || top < 1) {
  console.error(`ds-coverage: --top must be a positive integer, got '${values.top}'\n${USAGE}`);
  process.exit(2);
}

const censusInclude = values.include ?? [];
const censusExclude = values.exclude ?? [];
let report;
try {
  report = analyzeDsCoverage({
    projectDir: dir,
    dsPackages,
    censusInclude,
    censusExclude,
    includeNodes: values.nodes,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

if (values.json) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log(`ds-coverage of ${dir}`);
console.log(`  DS packages:  ${report.dsPackages.join(', ')}`);
if (report.censusInclude.length > 0) {
  console.log(`  include:      ${report.censusInclude.join(', ')}`);
}
if (report.censusExclude.length > 0) {
  console.log(`  exclude:      ${report.censusExclude.join(', ')} (excluded files still resolve)`);
}
console.log(
  `  files:        ${report.files} (${report.parseFailures.length} unparseable, ${report.readFailures.length} unreadable)`
);
console.log(`  JSX nodes:    ${report.nodes.all} weighted`);
console.table({
  host: report.nodes.host,
  ds: report.nodes.ds,
  external: report.nodes.external,
  local: report.nodes.local,
  unresolved: report.nodes.unresolved,
});
console.log(`  DS share of all JSX nodes:        ${report.dsShareOfAllNodes}`);
console.log(`  DS share of component elements:   ${report.dsShareOfComponentNodes}`);
console.log(`  … of all, instance-weighted:        ${report.instances.dsShareOfAllNodes}`);
console.log(`  … of components, instance-weighted: ${report.instances.dsShareOfComponentNodes}`);

const multiplied = Object.entries(report.instances.multipliers);
if (multiplied.length > 0) {
  console.log(
    `\nInstantiation multipliers ≠ 1 (top ${Math.min(top, multiplied.length)} of ${multiplied.length}):`
  );
  console.table(Object.fromEntries(multiplied.slice(0, top)));
}

const nonHost = Object.entries(report.components).filter(([, entry]) => entry.category !== 'host');
console.log(`\nTop components (of ${nonHost.length}):`);
console.table(Object.fromEntries(nonHost.slice(0, top)));

if (report.unresolvedElements.length > 0) {
  console.log(`Unresolved elements (${report.unresolvedElements.length}):`);
  for (const element of report.unresolvedElements.slice(0, top)) {
    console.log(`  ${element.file}:${element.line} <${element.tag}> — ${element.reason}`);
  }
  if (report.unresolvedElements.length > top) {
    console.log(`  … ${report.unresolvedElements.length - top} more (use --json for all)`);
  }
}

if (values['per-file']) {
  console.log('\nPer-file:');
  console.table(report.perFile);
}

// The node census is opt-in: without --nodes the analyzer omits nodeList
// entirely, so this section is absent rather than empty.
if (values.nodes && report.nodeList) {
  console.log(`\nNodes (${report.nodeList.length}):`);
  for (const node of report.nodeList.slice(0, top)) {
    console.log(`  [${node.category}] ${node.file}:${node.line}  ${node.path}`);
  }
  if (report.nodeList.length > top) {
    console.log(`  … ${report.nodeList.length - top} more (use --json for all)`);
  }
}
