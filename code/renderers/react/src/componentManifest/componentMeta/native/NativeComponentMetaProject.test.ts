/**
 * What the native-API project does that the shared manager and extraction tests do not cover: the
 * root set and the snapshot follow the files on disk, the facades keep object identity, and the
 * compiler process goes away with the manager.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import type { StoryRef } from '../../getComponentImports.ts';
import { ComponentMetaManager } from '../ComponentMetaManager.ts';
import {
  cleanup,
  createTempProject,
  loadNativeTypeScriptModules,
  tsconfigJSON,
} from '../test-helpers.ts';
import { NativeComponentMetaProject } from './NativeComponentMetaProject.ts';
import { NativeFacades } from './native-checker.ts';
import { type NativeTypeScriptModules, createNativeDocgenTypeScript } from './native-typescript.ts';

const component = (name: string, props: string) => dedent`
  import React from 'react';
  export interface ${name}Props {
    ${props}
  }
  export const ${name} = (props: ${name}Props) => <div>{JSON.stringify(props)}</div>;
`;

const story = (name: string) => dedent`
  import { ${name} } from './${name}';
  export default { component: ${name} };
  export const Default = {};
`;

const ref = (storyPath: string, componentPath: string, name: string): StoryRef => ({
  storyPath,
  component: {
    componentName: name,
    importName: name,
    importId: `./${name}`,
    path: componentPath,
    isPackage: false,
  },
});

const propNames = (entry: StoryRef) =>
  Object.keys(entry.component?.reactComponentMeta?.props ?? {});

let modules: NativeTypeScriptModules;
const dirs: string[] = [];

beforeAll(async () => {
  modules = await loadNativeTypeScriptModules();
});

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    cleanup(dir);
  }
});

/** A project whose tsconfig includes only `src`. */
function createProject(files: Record<string, string>) {
  const tsconfig = { ...JSON.parse(tsconfigJSON()), include: ['src'] };
  const project = createTempProject(files, tsconfig);
  dirs.push(project.projectDir);
  return project;
}

describe('NativeComponentMetaProject', () => {
  it('documents a component created after the program was built', () => {
    const { projectDir, filePaths } = createProject({
      'src/Button.tsx': component('Button', 'label: string;'),
      'src/Button.stories.tsx': story('Button'),
    });
    const manager = new ComponentMetaManager({ api: 'native', typescript: modules });
    try {
      const button = ref(
        filePaths['src/Button.stories.tsx'],
        filePaths['src/Button.tsx'],
        'Button'
      );
      manager.batchExtract([button]);
      expect(propNames(button)).toEqual(['label']);

      const tagPath = path.join(projectDir, 'src/Tag.tsx');
      const tagStoryPath = path.join(projectDir, 'src/Tag.stories.tsx');
      fs.writeFileSync(tagPath, component('Tag', 'text: string; color?: string;'));
      fs.writeFileSync(tagStoryPath, story('Tag'));
      manager.onFilesChanged([
        { filePath: tagPath, type: 'created' },
        { filePath: tagStoryPath, type: 'created' },
      ]);

      const tag = ref(tagStoryPath, tagPath, 'Tag');
      manager.batchExtract([tag]);
      expect(propNames(tag)).toEqual(['text', 'color']);
    } finally {
      manager.dispose();
    }
  });

  it('documents a component outside the tsconfig include by growing the root set', () => {
    const { filePaths } = createProject({
      'src/Button.tsx': component('Button', 'label: string;'),
      'src/Button.stories.tsx': story('Button'),
      // A symlinked story directory resolves to a real path like this one, outside `src`.
      'elsewhere/Panel.tsx': component('Panel', 'title: string;'),
      'elsewhere/Panel.stories.tsx': story('Panel'),
    });
    const manager = new ComponentMetaManager({ api: 'native', typescript: modules });
    try {
      const panel = ref(
        filePaths['elsewhere/Panel.stories.tsx'],
        filePaths['elsewhere/Panel.tsx'],
        'Panel'
      );
      manager.batchExtract([panel]);
      expect(propNames(panel)).toEqual(['title']);
    } finally {
      manager.dispose();
    }
  });

  it('re-extracts a changed component and forgets a deleted one', () => {
    const { filePaths } = createProject({
      'src/Button.tsx': component('Button', 'label: string;'),
      'src/Button.stories.tsx': story('Button'),
    });
    const manager = new ComponentMetaManager({ api: 'native', typescript: modules });
    try {
      const buttonPath = filePaths['src/Button.tsx'];
      const button = ref(filePaths['src/Button.stories.tsx'], buttonPath, 'Button');
      manager.batchExtract([button]);
      expect(propNames(button)).toEqual(['label']);

      fs.writeFileSync(buttonPath, component('Button', 'label: string; disabled?: boolean;'));
      manager.onFilesChanged([{ filePath: buttonPath, type: 'changed' }]);
      manager.batchExtract([button]);
      expect(propNames(button)).toEqual(['label', 'disabled']);

      const project = manager.getProjectForFile(buttonPath);
      expect(project.hasSourceFile(buttonPath)).toBe(true);
      fs.unlinkSync(buttonPath);
      manager.onFilesChanged([{ filePath: buttonPath, type: 'deleted' }]);
      expect(project.hasSourceFile(buttonPath)).toBe(false);
    } finally {
      manager.dispose();
    }
  });

  it('ignores extraction after dispose', () => {
    const { filePaths } = createProject({
      'src/Button.tsx': component('Button', 'label: string;'),
      'src/Button.stories.tsx': story('Button'),
    });
    const manager = new ComponentMetaManager({ api: 'native', typescript: modules });
    try {
      const button = ref(
        filePaths['src/Button.stories.tsx'],
        filePaths['src/Button.tsx'],
        'Button'
      );
      const project = manager.getProjectForFile(button.storyPath);
      project.dispose();

      expect(() => project.extractPropsFromStories([button])).not.toThrow();
      expect(button.component?.reactComponentMeta).toBeUndefined();
    } finally {
      manager.dispose();
    }
  });
});

describe('NativeFacades', () => {
  it('returns the same symbol and type objects for the same native objects', () => {
    const { projectDir, configPath, filePaths } = createProject({
      'src/Button.tsx': component('Button', 'label: string;'),
    });
    const api = new modules.sync.API({ cwd: projectDir });
    try {
      const typescript = createNativeDocgenTypeScript(modules, api);
      const { fileNames, options, projectReferences } = api.parseConfigFile(configPath);
      const project = new NativeComponentMetaProject(
        api,
        typescript,
        { fileNames: [...fileNames], options, projectReferences },
        configPath
      );
      const sourceFile = project.getSourceFile(filePaths['src/Button.tsx'])!;
      const facades = new NativeFacades(project['project'], typescript);
      const checker = facades.createChecker();

      const moduleSymbol = checker.getSymbolAtLocation(sourceFile)!;
      expect(checker.getSymbolAtLocation(sourceFile)).toBe(moduleSymbol);

      const [exported] = checker.getExportsOfModule(moduleSymbol);
      expect(checker.getExportsOfModule(moduleSymbol)[0]).toBe(exported);
      const type = checker.getTypeOfSymbol(exported);
      expect(checker.getTypeOfSymbol(exported)).toBe(type);
      expect(typescript.getEmptyObjectType(checker).getApparentProperties()).toEqual([]);
      expect(checker.typeToString(typescript.getEmptyObjectType(checker))).toBe('{}');
      project.dispose();
    } finally {
      api.close();
    }
  });
});
