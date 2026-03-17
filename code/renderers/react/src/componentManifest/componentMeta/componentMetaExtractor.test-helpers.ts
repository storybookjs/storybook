import * as fs from 'node:fs';
import * as path from 'node:path';

import { loadCsf } from 'storybook/internal/csf-tools';

import ts from 'typescript';

import { type StoryRef, getComponents } from '../getComponentImports';
import { ComponentMetaProject } from './ComponentMetaProject';
import type { ComponentDoc } from './componentMetaExtractor';
import { cleanup, createTempProject } from './test-helpers';

/** Create a temp TypeScript project from files, run a callback, then dispose and clean up. */
export async function withProject<T>(
  files: Record<string, string>,
  fn: (project: ComponentMetaProject, filePaths: Record<string, string>) => T | Promise<T>
): Promise<T> {
  const { projectDir, configPath, filePaths } = createTempProject(files);
  const parsed = ts.parseJsonSourceFileConfigFileContent(
    ts.readJsonConfigFile(configPath, ts.sys.readFile),
    ts.sys,
    projectDir,
    {},
    configPath
  );
  const project = new ComponentMetaProject(ts, parsed, configPath);
  try {
    return await fn(project, filePaths);
  } finally {
    project.dispose();
    cleanup(projectDir);
  }
}

/**
 * Extract props using the full production flow: loadCsf → getComponents → extractPropsFromStories.
 * Returns the full StoryRef so callers can also inspect importOverride, componentJsDocTags, etc.
 */
export async function extractFromStory(
  files: Record<string, string>,
  storyFileName: string,
  options?: { componentName?: string }
): Promise<StoryRef> {
  return withProject(files, async (project, filePaths) => {
    const storyPath = filePaths[storyFileName];
    const storyContent = fs.readFileSync(storyPath, 'utf-8');
    const csf = loadCsf(storyContent, { makeTitle: () => 'Test' }).parse();

    const components = await getComponents({
      csf,
      storyFilePath: storyPath,
      docgenEngine: 'react-component-meta',
    });

    const targetName = options?.componentName ?? csf._meta?.component;
    const component = targetName
      ? components.find((c) => c.componentName === targetName)
      : components[0];

    const entry: StoryRef = { storyPath, component };
    project.extractPropsFromStories([entry]);
    return entry;
  });
}

/**
 * Convenience wrapper: auto-generates a story file and extracts a single component's props.
 * Uses the full production flow (loadCsf → getComponents → extractPropsFromStories).
 * Throws if extraction fails.
 */
export async function extract(
  exportName: string,
  content: string,
  options?: { ext?: string }
): Promise<ComponentDoc> {
  const ext = options?.ext ?? 'tsx';
  const fileName = `test/Component.${ext}`;
  const baseName = path.basename(fileName, path.extname(fileName));
  const componentName = exportName === 'default' ? 'Component' : exportName;
  const importLine =
    exportName === 'default'
      ? `import ${componentName} from './${baseName}';`
      : `import { ${exportName} as ${componentName} } from './${baseName}';`;

  const entry = await extractFromStory(
    {
      [fileName]: content,
      [`test/${baseName}.stories.tsx`]: `${importLine}\nexport default { component: ${componentName} };`,
    },
    `test/${baseName}.stories.tsx`
  );

  const doc = entry.component?.reactComponentMeta;
  if (!doc) {
    throw new Error(`extract() failed: no ComponentDoc returned for export "${exportName}"`);
  }
  return doc;
}
