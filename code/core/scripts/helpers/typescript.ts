import { join } from 'node:path';

import { typescript } from '../../../../scripts/prepare/tools';

export function getTSDiagnostics(
  program: typescript.Program,
  cwd: string,
  host: typescript.CompilerHost
): any {
  return typescript.formatDiagnosticsWithColorAndContext(
    typescript.getPreEmitDiagnostics(program).filter((d) => d.file?.fileName.startsWith(cwd)),
    host
  );
}
export function getTSProgramAndHost(fileNames: string[], options: typescript.CompilerOptions) {
  const program = typescript.createProgram({
    rootNames: fileNames,
    options: {
      module: typescript.ModuleKind.CommonJS,
      ...options,
      declaration: false,
      noEmit: true,
    },
  });

  const host = typescript.createCompilerHost(program.getCompilerOptions());
  return { program, host };
}
export function getTSFilesAndConfig(tsconfigPath: string) {
  const content = typescript.readJsonConfigFile(tsconfigPath, typescript.sys.readFile);
  return typescript.parseJsonSourceFileConfigFileContent(
    content,
    {
      useCaseSensitiveFileNames: true,
      readDirectory: typescript.sys.readDirectory,
      fileExists: typescript.sys.fileExists,
      readFile: typescript.sys.readFile,
    },
    process.cwd(),
    {
      noEmit: true,
      outDir: join(process.cwd(), 'types'),
      target: typescript.ScriptTarget.ES2022,
      declaration: false,
    }
  );
}
