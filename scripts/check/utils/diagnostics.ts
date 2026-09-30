import { isAbsolute, relative, resolve } from 'node:path';

// Head line of a tsc `--pretty false` diagnostic: `path(line,col): error TSxxxx:`.
const DIAGNOSTIC_HEAD = /^(.+?)\(\d+,\d+\): (?:error|warning) TS\d+:/;

// `tsc -p` reports the whole program, including files from other workspace packages; only
// diagnostics inside the checked package count. Indented lines elaborate the preceding diagnostic.
export function filterToPackageDiagnostics(output: string, packageDir: string) {
  const kept: string[] = [];
  let sawDiagnostic = false;
  let keepBlock = false;

  for (const line of output.split(/\r?\n/)) {
    const head = DIAGNOSTIC_HEAD.exec(line);
    if (head) {
      sawDiagnostic = true;
      const rel = relative(packageDir, resolve(packageDir, head[1]));
      keepBlock = !rel.startsWith('..') && !isAbsolute(rel);
      if (keepBlock) {
        kept.push(line);
      }
    } else if (/^\s/.test(line)) {
      if (keepBlock) {
        kept.push(line);
      }
    } else if (line.trim() !== '') {
      // File-less output (config errors like `error TS5083`, crashes) always fails.
      keepBlock = true;
      kept.push(line);
    }
  }

  return { kept, sawDiagnostic };
}
