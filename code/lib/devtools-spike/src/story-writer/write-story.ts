import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

import { babelParse, types as t, traverse } from 'storybook/internal/babel';
import { formatFileContent } from 'storybook/internal/common';
import {
  buildImportStatements,
  collectImportBindings,
  loadCsf,
  printCsf,
  readCsf,
  resolveComponentImport,
  type CsfFile,
  type ImportRef,
} from 'storybook/internal/csf-tools';
import picomatch from 'picomatch';

import type { StoryGenerationResult } from '../types.ts';
import { removeExtraNewlines } from './recast-workaround.ts';

// Local spike error; core's categorized StorybookError registry is for core's user-facing errors.
class SpikeError extends Error {}

export interface ComponentImport {
  componentName: string; // as written in the story file, e.g. `Button` or `Card.List`
  importPath: string; // module specifier the component is imported from
  importName?: string; // exported name; default: the base of componentName; 'default' for default imports
}

export interface WriteStoryOptions {
  storiesGlob: string | readonly string[];
  title?: string; // new files only
  component?: ComponentImport; // merge this import when the file does not have it yet
}

export interface WrittenStory {
  filePath: string;
  storyName: string;
}

const assertWithinStoriesGlob = (
  filePath: string,
  storiesGlob: string | readonly string[]
): void => {
  const patterns = typeof storiesGlob === 'string' ? [storiesGlob] : [...storiesGlob];
  const absolute = resolve(filePath);
  const candidates = [absolute, relative(process.cwd(), absolute)];
  if (!candidates.some((candidate) => picomatch.isMatch(candidate, patterns, { dot: true }))) {
    throw new SpikeError(
      `Refusing to write "${filePath}" — it is outside the allowed stories glob (${patterns.join(', ')})`
    );
  }
};

const freshImportRef = (component: ComponentImport): ImportRef => {
  const base = component.componentName.split('.')[0];
  return {
    importId: component.importPath,
    importName: component.importName ?? base,
    localImportName: base,
  };
};

const componentExpression = (componentName: string): t.Expression => {
  const [base, ...members] = componentName.split('.');
  if (!base) {
    throw new SpikeError(`Invalid component name "${componentName}"`);
  }
  return members.reduce<t.Expression>(
    (expression, member) => t.memberExpression(expression, t.identifier(member)),
    t.identifier(base)
  );
};

const mergeImports = (csf: CsfFile, statements: string[]): void => {
  if (statements.length === 0) {
    return;
  }
  const nodes = statements.map((statement) => {
    const [node] = babelParse(statement).program.body;
    if (!node) {
      throw new SpikeError(`Failed to parse generated import statement: ${statement}`);
    }
    return node;
  });
  traverse(csf._ast, {
    Program(path) {
      path.unshiftContainer('body', nodes);
    },
  });
};

const valueToAst = (value: unknown): t.Expression => {
  if (value === null) {
    return t.nullLiteral();
  }
  switch (typeof value) {
    case 'string':
      return t.stringLiteral(value);
    case 'number':
      if (!Number.isFinite(value)) {
        throw new SpikeError('Cannot write a non-finite number into story args');
      }
      return t.numericLiteral(value);
    case 'boolean':
      return t.booleanLiteral(value);
    case 'object':
      if (Array.isArray(value)) {
        return t.arrayExpression(value.map(valueToAst));
      }
      return t.objectExpression(
        Object.entries(value).map(([key, child]) =>
          t.objectProperty(
            t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key),
            valueToAst(child)
          )
        )
      );
    default:
      throw new SpikeError(`Cannot write a ${typeof value} into story args`);
  }
};

const addStoryExport = (csf: CsfFile, generation: StoryGenerationResult): void => {
  const { storyName, args, argTypes } = generation;
  if (!t.isValidIdentifier(storyName)) {
    throw new SpikeError(`Story name "${storyName}" is not a valid JavaScript identifier`);
  }
  if (csf.getStoryExport(storyName)) {
    throw new SpikeError(
      `Story "${storyName}" already exists in this file — pick the next free variant name instead of overwriting`
    );
  }
  const properties: t.ObjectProperty[] = [];
  if (Object.keys(args).length > 0) {
    properties.push(t.objectProperty(t.identifier('args'), valueToAst(args)));
  }
  if (Object.keys(argTypes).length > 0) {
    properties.push(t.objectProperty(t.identifier('argTypes'), valueToAst(argTypes)));
  }
  const declarator = t.variableDeclarator(t.identifier(storyName), t.objectExpression(properties));
  traverse(csf._ast, {
    Program(path) {
      path.pushContainer(
        'body',
        t.exportNamedDeclaration(t.variableDeclaration('const', [declarator]))
      );
    },
  });
};

const mergeComponentImport = (csf: CsfFile, component: ComponentImport): void => {
  const resolved = resolveComponentImport(
    component.componentName,
    collectImportBindings(csf._file.path)
  );
  if (resolved.importId) {
    return; // the file already binds the component's base identifier
  }
  mergeImports(csf, buildImportStatements({ refs: [freshImportRef(component)] }));
};

const writePrinted = async (csf: CsfFile, filePath: string, storyName: string): Promise<void> => {
  const printed = removeExtraNewlines(printCsf(csf).code, storyName);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, await formatFileContent(filePath, printed));
};

/**
 * Create a new story file from a minimal CSF source, following the loadCsf
 * docstring pattern in CsfFile.ts, with the component import, meta, and the
 * generated story export.
 */
export async function writeStoryFile(
  filePath: string,
  generation: StoryGenerationResult,
  options: WriteStoryOptions & { component: ComponentImport }
): Promise<WrittenStory> {
  assertWithinStoriesGlob(filePath, options.storiesGlob);

  const { component } = options;
  const importStatements = buildImportStatements({ refs: [freshImportRef(component)] });
  const source = [...importStatements, 'export default {};'].join('\n') + '\n';
  const csf = loadCsf(source, {
    fileName: filePath,
    makeTitle: (userTitle) => userTitle || options.title || component.componentName,
  }).parse();

  const meta = csf._metaNode;
  if (!meta) {
    throw new SpikeError('The generated story file has no meta object to configure');
  }
  meta.properties.push(
    t.objectProperty(
      t.identifier('title'),
      t.stringLiteral(options.title ?? component.componentName)
    ),
    t.objectProperty(t.identifier('component'), componentExpression(component.componentName))
  );
  addStoryExport(csf, generation);

  await writePrinted(csf, filePath, generation.storyName);
  return { filePath, storyName: generation.storyName };
}

/**
 * Append a variant story export to an existing CSF file, preserving comments
 * and formatting via recast.
 */
export async function appendVariant(
  filePath: string,
  generation: StoryGenerationResult,
  options: WriteStoryOptions
): Promise<WrittenStory> {
  assertWithinStoriesGlob(filePath, options.storiesGlob);

  const csf = await readCsf(filePath, {
    makeTitle: (userTitle) => userTitle || 'devtools-spike',
  });
  const parsed = csf.parse();
  if (options.component) {
    mergeComponentImport(parsed, options.component);
  }
  addStoryExport(parsed, generation);

  await writePrinted(parsed, filePath, generation.storyName);
  return { filePath, storyName: generation.storyName };
}
