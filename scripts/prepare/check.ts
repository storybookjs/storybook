import { readJson } from '@ndelangen/fs-extra-unified';
import { join } from 'path';
import ts from 'typescript';

const run = async ({ cwd }: { cwd: string }) => {
  const {
    bundler: { tsConfig: tsconfigPath = 'tsconfig.json' },
  } = await readJson(join(cwd, 'package.json'));

  const { options, fileNames } = getTSFilesAndConfig(tsconfigPath);
  const { program, host } = getTSProgramAndHost(fileNames, options);

  const tsDiagnostics = getTSDiagnostics(program, cwd, host);
  if (tsDiagnostics.length > 0) {
    console.log(tsDiagnostics);
    process.exit(1);
  } else {
    console.log('no type errors');
  }

  // TODO, add more package checks here, like:
  // - check for missing dependencies/peerDependencies
  // - check for unused exports

  if (process.env.CI !== 'true') {
    console.log('done');
  }
};

run({ cwd: process.cwd() }).catch((err: unknown) => {
  // We can't let the stack try to print, it crashes in a way that sets the exit code to 0.
  // Seems to have something to do with running JSON.parse() on binary / base64 encoded sourcemaps
  // in @cspotcode/source-map-support
  if (err instanceof Error) {
    console.error(err.message);
  }
  process.exit(1);
});

function getTSDiagnostics(program: ts.Program, cwd: string, host: ts.CompilerHost): any {
  return ts.formatDiagnosticsWithColorAndContext(
    ts.getPreEmitDiagnostics(program).filter((d) => d.file?.fileName.startsWith(cwd)),
    host
  );
}

function getTSProgramAndHost(fileNames: string[], options: ts.CompilerOptions) {
  const program = ts.createProgram({
    rootNames: fileNames,
    options: {
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      ...options,
      declaration: false,
      noEmit: true,
    },
  });

  const host = ts.createCompilerHost(program.getCompilerOptions());
  return { program, host };
}

function getTSFilesAndConfig(tsconfigPath: string) {
  const content = ts.readJsonConfigFile(tsconfigPath, ts.sys.readFile);
  return ts.parseJsonSourceFileConfigFileContent(
    content,
    {
      useCaseSensitiveFileNames: true,
      readDirectory: ts.sys.readDirectory,
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
    },
    process.cwd(),
    {
      noEmit: true,
      outDir: join(process.cwd(), 'types'),
      target: ts.ScriptTarget.ES2022,
      declaration: false,
    }
  );
}
