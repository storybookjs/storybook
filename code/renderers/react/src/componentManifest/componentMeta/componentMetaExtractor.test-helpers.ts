import * as path from 'node:path';

import { extractDeclaredSubcomponents } from 'storybook/internal/common';
import { loadCsf } from 'storybook/internal/csf-tools';

import { vol } from 'memfs';
import ts from 'typescript';

import { type StoryRef, getComponents } from '../getComponentImports.ts';
import { findMatchingComponent } from '../resolveComponents.ts';
import { ComponentMetaProject } from './ComponentMetaProject.ts';
import { createTempProject, cleanup, writeFiles } from './test-helpers.ts';

/**
 * Shared LanguageService across all tests — avoids re-parsing @types/react per test. First
 * getProgram() is ~300ms, subsequent incremental rebuilds are ~5ms.
 */
const { projectDir, configPath } = createTempProject({});
const fsFileSnapshots = new Map<string, [number | undefined, ts.IScriptSnapshot | undefined]>();
const sharedProject = new ComponentMetaProject(
  ts,
  ts.parseJsonSourceFileConfigFileContent(
    ts.readJsonConfigFile(configPath, ts.sys.readFile),
    ts.sys,
    projectDir,
    {},
    configPath
  ),
  configPath,
  fsFileSnapshots
);

/** Reads a project file from the in-memory mirror populated by {@link withProject}. */
export function readProjectFile(filePath: string): string {
  return vol.readFileSync(filePath, 'utf-8') as string;
}

/** Resets the memfs mirror between tests. */
export function resetProjectVolume(): void {
  vol.reset();
}

/** Write files into the shared project, invalidate caches, and run a callback. */
export async function withProject<T>(
  files: Record<string, string>,
  fn: (project: ComponentMetaProject, filePaths: Record<string, string>) => T | Promise<T>
): Promise<T> {
  vol.reset();
  const filePaths = writeFiles(projectDir, files);
  vol.fromNestedJSON(
    Object.fromEntries(Object.entries(filePaths).map(([name, filePath]) => [filePath, files[name]]))
  );
  // Report every rewritten path as changed: the tracker evicts its snapshots and bumps versions,
  // which stays correct even when consecutive writes land within one mtime tick.
  sharedProject.onFilesChanged(
    Object.values(filePaths).map((filePath) => ({ filePath, type: 'changed' as const }))
  );
  return fn(sharedProject, filePaths);
}

/** Parses a story file and resolves declared subcomponents for extraction tests. */
export async function loadDeclaredSubcomponentComponents({
  filePaths,
  storyFileName,
  title,
}: {
  filePaths: Record<string, string>;
  storyFileName: string;
  title: string;
}) {
  const storyPath = filePaths[storyFileName];
  const csf = loadCsf(readProjectFile(storyPath), { makeTitle: () => title }).parse();
  const declaredSubcomponents = extractDeclaredSubcomponents(csf);
  const components = await getComponents({
    csf,
    storyFilePath: storyPath,
    docgenEngine: 'react-component-meta',
    additionalComponentNames: declaredSubcomponents.map(
      (subcomponent) => subcomponent.componentName
    ),
  });

  return { storyPath, csf, declaredSubcomponents, components };
}

/**
 * The extraction steps shared by every project variant: parse CSF, resolve components, and run
 * extraction. Project configuration happens at the call sites.
 */
async function extractFromProject(
  project: ComponentMetaProject,
  filePaths: Record<string, string>,
  storyFileName: string,
  componentName?: string
): Promise<StoryRef> {
  const storyPath = filePaths[storyFileName];
  const title = path.basename(storyFileName).replace(/\.stories\.\w+$/, '');
  const csf = loadCsf(readProjectFile(storyPath), {
    makeTitle: () => title,
  }).parse();

  const components = await getComponents({
    csf,
    storyFilePath: storyPath,
    docgenEngine: 'react-component-meta',
  });

  const component = findMatchingComponent(components, componentName ?? csf._meta?.component, title);

  const entry: StoryRef = { storyPath, component };
  project.extractPropsFromStories([entry]);
  return entry;
}

/**
 * Full production flow: loadCsf → getComponents → extractPropsFromStories. Title is auto-derived
 * from the story file name for findMatchingComponent.
 */
export async function extractFromStory(
  files: Record<string, string>,
  storyFileName: string,
  options?: { componentName?: string }
): Promise<StoryRef> {
  return withProject(files, (project, filePaths) =>
    extractFromProject(project, filePaths, storyFileName, options?.componentName)
  );
}

/**
 * Full production flow through a dedicated project with a custom tsconfig — for suites whose
 * fixtures need compiler options the shared project does not enable (e.g. allowJs for untyped
 * .jsx components). Sharing one global config would change behavior for every other suite (e.g.
 * docgen's unresolved-default resolution), so these build their own project and mirror the files
 * into the memfs volume the extraction reads from.
 */
export async function extractFromStoryWithConfig(
  files: Record<string, string>,
  storyFileName: string,
  tsconfig: object
): Promise<StoryRef> {
  vol.reset();
  const { projectDir, configPath, filePaths } = createTempProject(files, tsconfig);
  vol.fromNestedJSON(
    Object.fromEntries(Object.entries(filePaths).map(([name, filePath]) => [filePath, files[name]]))
  );
  const project = new ComponentMetaProject(
    ts,
    ts.parseJsonSourceFileConfigFileContent(
      ts.readJsonConfigFile(configPath, ts.sys.readFile),
      ts.sys,
      projectDir,
      {},
      configPath
    ),
    configPath,
    new Map()
  );

  try {
    return await extractFromProject(project, filePaths, storyFileName);
  } finally {
    cleanup(projectDir);
  }
}

/**
 * Convenience wrapper: generates a story with meta.component and extracts props. Goes through the
 * fallback path (resolveFromMetaComponent, no JSX).
 */
export async function extract(exportName: string, content: string): Promise<StoryRef> {
  const componentName = exportName === 'default' ? 'Component' : exportName;
  const importLine =
    exportName === 'default'
      ? `import ${componentName} from './Component';`
      : `import { ${exportName} as ${componentName} } from './Component';`;

  return extractFromStory(
    {
      'test/Component.tsx': content,
      'test/Component.stories.tsx': `${importLine}\nexport default { component: ${componentName} };`,
    },
    'test/Component.stories.tsx'
  );
}
