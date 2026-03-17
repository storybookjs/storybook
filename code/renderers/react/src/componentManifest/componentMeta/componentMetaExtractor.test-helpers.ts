import * as fs from 'node:fs';

import { loadCsf } from 'storybook/internal/csf-tools';

import ts from 'typescript';

import { type StoryRef, getComponents } from '../getComponentImports';
import { ComponentMetaProject } from './ComponentMetaProject';
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
    const csf = loadCsf(fs.readFileSync(storyPath, 'utf-8'), { makeTitle: () => 'Test' }).parse();

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
 * Convenience wrapper: auto-generates a story file and extracts a single component's props. Uses
 * the full production flow (loadCsf → getComponents → extractPropsFromStories).
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
