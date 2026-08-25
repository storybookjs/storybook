import { isAbsolute, join, relative, resolve } from 'node:path';

import typescript from 'typescript';

/** Matches the head line of a tsc `--pretty false` diagnostic: `path(line,col): error TSxxxx:`. */
const DIAGNOSTIC_HEAD = /^(.+?)\(\d+,\d+\): (?:error|warning) TS\d+:/;

/**
 * A `tsc -p` run reports diagnostics for the whole program, including files
 * pulled in from other workspace packages. Only diagnostics located inside
 * the checked package fail its check — the same contract as the previous
 * TS 6 compiler-API implementation, which filtered by file path. Indented
 * lines are elaboration of the preceding diagnostic and follow its verdict.
 */
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

export function getTSFilesAndConfig(tsconfigPath: string, cwd: string = process.cwd()) {
  const content = typescript.readJsonConfigFile(tsconfigPath, typescript.sys.readFile);
  return typescript.parseJsonSourceFileConfigFileContent(
    content,
    {
      useCaseSensitiveFileNames: true,
      readDirectory: typescript.sys.readDirectory,
      fileExists: typescript.sys.fileExists,
      readFile: typescript.sys.readFile,
    },
    cwd,
    {
      noEmit: true,
      outDir: join(cwd, 'types'),
      target: typescript.ScriptTarget.ES2022,
      declaration: false,
    }
  );
}
