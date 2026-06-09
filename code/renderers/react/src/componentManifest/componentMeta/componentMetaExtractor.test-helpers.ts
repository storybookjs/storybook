import * as fs from 'node:fs';
import * as path from 'node:path';

import { loadCsf } from 'storybook/internal/csf-tools';

import ts from 'typescript';

import { type StoryRef, getComponents } from '../getComponentImports.ts';
import { findMatchingComponent } from '../resolveComponents.ts';
import { ComponentMetaProject } from './ComponentMetaProject.ts';
import { createTempProject, writeFiles } from './test-helpers.ts';

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

/** Write files into the shared project, invalidate caches, and run a callback. */
export async function withProject<T>(
  files: Record<string, string>,
  fn: (project: ComponentMetaProject, filePaths: Record<string, string>) => T | Promise<T>
): Promise<T> {
  const filePaths = writeFiles(projectDir, files);
  for (const fp of Object.values(filePaths)) {
    fsFileSnapshots.delete(fp);
  }
  (sharedProject as any).projectVersion++;
  return fn(sharedProject, filePaths);
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
  return withProject(files, async (project, filePaths) => {
    const storyPath = filePaths[storyFileName];
    const title = path.basename(storyFileName).replace(/\.stories\.\w+$/, '');
    const csf = loadCsf(fs.readFileSync(storyPath, 'utf-8'), {
      makeTitle: () => title,
    }).parse();

    const components = await getComponents({
      csf,
      storyFilePath: storyPath,
      docgenEngine: 'react-component-meta',
    });

    const componentName = options?.componentName ?? csf._meta?.component;
    const component = findMatchingComponent(components, componentName, title);

    const entry: StoryRef = { storyPath, component };
    project.extractPropsFromStories([entry]);
    return entry;
  });
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
