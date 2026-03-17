import * as path from 'node:path';

import { loadCsf } from 'storybook/internal/csf-tools';

import ts from 'typescript';

import { type StoryRef, getComponents } from '../getComponentImports';
import { ComponentMetaProject } from './ComponentMetaProject';
import type { ComponentDoc } from './componentMetaExtractor';
import { cleanup, createTempProject, sys } from './test-helpers';

/** Create a temp TypeScript project from files, run a callback, then dispose and clean up. */
export function withProject<T>(
  files: Record<string, string>,
  fn: (project: ComponentMetaProject, filePaths: Record<string, string>) => T
): T {
  const { projectDir, configPath, filePaths } = createTempProject(files);
  const parsed = ts.parseJsonSourceFileConfigFileContent(
    ts.readJsonConfigFile(configPath, sys.readFile),
    sys,
    projectDir,
    {},
    configPath
  );
  const project = new ComponentMetaProject(ts, parsed, configPath);
  try {
    return fn(project, filePaths);
  } finally {
    project.dispose();
    cleanup(projectDir);
  }
}

/** Extract a single component's props by name from inline source. Throws if extraction fails. */
export function extract(
  exportName: string,
  content: string,
  options?: { ext?: string }
): ComponentDoc {
  const ext = options?.ext ?? 'tsx';
  const fileName = `test/Component.${ext}`;
  const baseName = path.basename(fileName, path.extname(fileName));
  const componentName = exportName === 'default' ? 'Component' : exportName;
  const importLine =
    exportName === 'default'
      ? `import ${componentName} from './${baseName}';`
      : `import { ${exportName} as ${componentName} } from './${baseName}';`;

  const doc = withProject(
    {
      [fileName]: content,
      [`test/${baseName}.stories.tsx`]: `${importLine}\nexport default { component: ${componentName} };`,
    },
    (project, filePaths) => {
      const entries: StoryRef[] = [
        {
          storyPath: filePaths[`test/${baseName}.stories.tsx`],
          component: {
            componentName,
            importName: exportName,
            isPackage: false,
            path: filePaths[fileName],
          },
        },
      ];
      project.extractPropsFromStories(entries);
      return entries[0].component?.reactComponentMeta;
    }
  );

  if (!doc) {
    throw new Error(`extract() failed: no ComponentDoc returned for export "${exportName}"`);
  }
  return doc;
}

/**
 * Extract props using the full production flow: loadCsf → getComponents → extractPropsFromStories.
 * Use for multi-file tests where story file structure matters.
 */
export async function extractFromStory(
  files: Record<string, string>,
  storyFileName: string,
  options?: { componentName?: string }
): Promise<StoryRef> {
  const { projectDir, configPath, filePaths } = createTempProject(files);
  const parsed = ts.parseJsonSourceFileConfigFileContent(
    ts.readJsonConfigFile(configPath, sys.readFile),
    sys,
    projectDir,
    {},
    configPath
  );
  const project = new ComponentMetaProject(ts, parsed, configPath);

  try {
    const storyPath = filePaths[storyFileName];
    const storyContent = sys.readFile(storyPath)!;
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
  } finally {
    project.dispose();
    cleanup(projectDir);
  }
}
