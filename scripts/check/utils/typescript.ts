import { join } from 'node:path';

import typescript from 'typescript';

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
