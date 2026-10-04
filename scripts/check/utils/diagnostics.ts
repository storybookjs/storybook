import { isAbsolute, relative, resolve } from 'node:path';

// Head line of a tsc `--pretty false` diagnostic: `path(line,col): error TSxxxx:`.
const DIAGNOSTIC_HEAD = /^(.+?)\(\d+,\d+\): (?:error|warning) TS\d+:/;

// `tsc -p` reports the whole program, including files from other workspace packages; only
// diagnostics inside the checked package count. Indented lines elaborate the preceding diagnostic.
// With `files`, only diagnostics in those files count.
export function filterToPackageDiagnostics(output: string, packageDir: string, files?: string[]) {
  const kept: string[] = [];
  let sawDiagnostic = false;
  let keepBlock = false;

  for (const line of output.split(/\r?\n/)) {
    const head = DIAGNOSTIC_HEAD.exec(line);
    if (head) {
      sawDiagnostic = true;
      const file = resolve(packageDir, head[1]);
      const rel = relative(packageDir, file);
      keepBlock = !rel.startsWith('..') && !isAbsolute(rel) && (!files || files.includes(file));
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
