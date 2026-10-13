import {
  findExportDefault,
  getConfigObjectFromMergeArg,
  getEffectiveMergeConfigCall,
  getTargetConfigObject,
  resolveExpression,
} from 'storybook/internal/cli';
import {
  type ESTree as E,
  SourceEditor,
  appendToList,
  arrayList,
  itemText,
  objectList,
  prependToList,
} from 'storybook/internal/csf-tools';

import { normalize } from 'pathe';

/**
 * The template is imported directly so the build system processes it as raw text: a mix of globs
 * and the "?raw" string query is not supported in esbuild.
 */
async function getTemplatePath() {
  return import('../templates/vitest.config.4.template.ts?raw');
}

export const loadTemplate = async (name: string, replacements: Record<string, string>) => {
  // Dynamically import the template file as plain text
  const templateModule = await getTemplatePath();
  let template = templateModule.default;
  // Normalize Windows paths (backslashes) to forward slashes for JavaScript string compatibility
  Object.entries(replacements).forEach(
    ([key, value]) => (template = template.replace(key, normalize(value)))
  );
  return template;
};

type Member = E.ObjectExpression['properties'][number];

// The template is merged from `source` into the user's config in `target`.
interface Merge {
  source: SourceEditor;
  target: SourceEditor;
}

const keyName = (member: Member) =>
  member.type === 'Property' &&
  !member.method &&
  member.kind === 'init' &&
  member.key.type === 'Identifier'
    ? member.key.name
    : undefined;

const findNamedProp = (members: Member[], name: string) =>
  members.find((member): member is E.ObjectProperty => keyName(member) === name);

const isProjectsArrayProp = (
  member: Member
): member is E.ObjectProperty & { value: E.ArrayExpression } =>
  keyName(member) === 'projects' && (member as E.ObjectProperty).value.type === 'ArrayExpression';

const memberTexts = (editor: SourceEditor, object: E.ObjectExpression, members: Member[]) =>
  members.map((member) => itemText(editor, objectList(object), member));

const elementTexts = (editor: SourceEditor, array: E.ArrayExpression) =>
  arrayList(array).items.map((element) => itemText(editor, arrayList(array), element));

const indent = (text: string, prefix: string) => prefix + text.replaceAll('\n', `\n${prefix}`);

const lineIndentAt = (code: string, index: number) =>
  /^[ \t]*/.exec(code.slice(code.lastIndexOf('\n', index - 1) + 1))![0];

// `appendToList` re-indents multi-line items only when the list itself spans lines.
const appendItems = (
  editor: SourceEditor,
  list: ReturnType<typeof arrayList>,
  texts: string[],
  padding?: string
) => {
  const inline = list.items.length > 0 && !editor.code.slice(list.open, list.close).includes('\n');
  const continuation = `\n${lineIndentAt(editor.code, list.open)}`;
  appendToList(
    editor,
    list,
    inline ? texts.map((text) => text.replaceAll('\n', continuation)) : texts,
    padding
  );
};

// Nested objects are merged, arrays concatenated, other values overwritten.
const mergeProperties = (
  { source, target }: Merge,
  from: E.ObjectExpression,
  into: E.ObjectExpression,
  fromMembers: Member[] = from.properties
) => {
  const appended: string[] = [];
  for (const sourceProp of fromMembers) {
    const name = keyName(sourceProp);
    if (!name) {
      continue;
    }
    const targetProp = findNamedProp(into.properties, name);
    if (!targetProp) {
      appended.push(...memberTexts(source, from, [sourceProp]));
      continue;
    }
    const { value: sourceValue } = sourceProp as E.ObjectProperty;
    const { value: targetValue } = targetProp;
    if (sourceValue.type === 'ObjectExpression' && targetValue.type === 'ObjectExpression') {
      mergeProperties({ source, target }, sourceValue, targetValue);
    } else if (sourceValue.type === 'ArrayExpression' && targetValue.type === 'ArrayExpression') {
      appendItems(target, arrayList(targetValue), elementTexts(source, sourceValue), '');
    } else if (targetProp.shorthand) {
      target.edits.overwrite(
        targetProp.start,
        targetProp.end,
        `${name}: ${source.source(sourceValue)}`
      );
    } else {
      target.edits.overwrite(targetValue.start, targetValue.end, source.source(sourceValue));
    }
  }
  if (appended.length > 0) {
    appendItems(target, objectList(into), appended);
  }
};

const appendToExistingProjects = (
  merge: Merge,
  existingProjects: E.ArrayExpression,
  testObject: E.ObjectExpression,
  templateConfig: E.ObjectExpression,
  targetConfig: E.ObjectExpression
) => {
  const templateTest = findNamedProp(templateConfig.properties, 'test');
  if (templateTest?.value.type === 'ObjectExpression') {
    const templateTestObject = templateTest.value;
    const templateProjects = templateTestObject.properties.find(isProjectsArrayProp);
    if (templateProjects) {
      appendItems(
        merge.target,
        arrayList(existingProjects),
        elementTexts(merge.source, templateProjects.value),
        ''
      );
    }
    const existingNames = new Set(testObject.properties.map(keyName));
    const added = templateTestObject.properties.filter((member) => {
      const name = keyName(member);
      return name !== undefined && name !== 'projects' && !existingNames.has(name);
    });
    if (added.length > 0) {
      appendItems(
        merge.target,
        objectList(testObject),
        memberTexts(merge.source, templateTestObject, added)
      );
    }
  }

  mergeProperties(
    merge,
    templateConfig,
    targetConfig,
    templateConfig.properties.filter((member) => keyName(member) !== 'test')
  );
};

// Run-wide test options, which stay on the top-level test object instead of moving into a project.
const TOP_LEVEL_TEST_PROPERTIES = [
  'shard',
  'watch',
  'run',
  'cache',
  'update',
  'reporters',
  'outputFile',
  'teardownTimeout',
  'silent',
  'forceRerunTriggers',
  'testNamePattern',
  'ui',
  'open',
  'uiBase',
  'snapshotFormat',
  'resolveSnapshotPath',
  'passWithNoTests',
  'onConsoleLog',
  'onStackTrace',
  'dangerouslyIgnoreUnhandledErrors',
  'slowTestThreshold',
  'inspect',
  'inspectBrk',
  'coverage',
  'watchTriggerPatterns',
];

// Moves the user's test config into the template's projects array as `{ extends: true, test }`.
const wrapTestConfigAsProject = (
  merge: Merge,
  existingTest: E.ObjectProperty,
  testObject: E.ObjectExpression,
  templateConfig: () => E.ObjectExpression,
  targetConfig: E.ObjectExpression
) => {
  const { source, target } = merge;
  const templateTestObject = findNamedProp(templateConfig().properties, 'test')!
    .value as E.ObjectExpression;
  const templateProjects = templateTestObject.properties.find(isProjectsArrayProp);
  if (!templateProjects) {
    mergeProperties(merge, templateConfig(), targetConfig);
    return;
  }

  const hoisted = TOP_LEVEL_TEST_PROPERTIES.map((name) =>
    findNamedProp(testObject.properties, name)
  ).filter((member) => member !== undefined);
  const projectMembers = testObject.properties.filter(
    (member) => !hoisted.includes(member as E.ObjectProperty)
  );
  const projectTest = memberTexts(target, testObject, projectMembers)
    .map((text) => `\n${indent(text, '    ')},`)
    .join('');
  const project = `{\n  extends: true,\n  test: {${projectTest}${projectTest ? '\n  ' : ''}},\n}`;

  prependToList(source, arrayList(templateProjects.value), [project], '');
  if (hoisted.length > 0) {
    prependToList(source, objectList(templateTestObject), memberTexts(target, testObject, hoisted));
  }
  source.commit();

  const config = templateConfig();
  const templateTest = findNamedProp(config.properties, 'test')!;
  const lineIndent = lineIndentAt(target.code, existingTest.start);
  target.edits.overwrite(
    existingTest.start,
    existingTest.end,
    itemText(source, objectList(config), templateTest).replaceAll('\n', `\n${lineIndent}`)
  );
  mergeProperties(
    merge,
    config,
    targetConfig,
    config.properties.filter((member) => member !== templateTest)
  );
};

const mergeTemplateIntoConfigObject = (
  merge: Merge,
  targetConfig: E.ObjectExpression,
  templateConfig: () => E.ObjectExpression
) => {
  const existingTest = findNamedProp(targetConfig.properties, 'test');
  const testObject = existingTest
    ? resolveExpression(existingTest.value, merge.target.program)
    : null;
  if (existingTest && testObject?.type === 'ObjectExpression') {
    const existingProjects = testObject.properties.find(isProjectsArrayProp);
    if (existingProjects) {
      appendToExistingProjects(
        merge,
        existingProjects.value,
        testObject,
        templateConfig(),
        targetConfig
      );
      return;
    }
    if (findNamedProp(templateConfig().properties, 'test')?.value.type === 'ObjectExpression') {
      wrapTestConfigAsProject(merge, existingTest, testObject, templateConfig, targetConfig);
      return;
    }
  }
  mergeProperties(merge, templateConfig(), targetConfig);
};

const findWritableConfigObject = (
  program: E.Program,
  exportDefault: E.ExportDefaultDeclaration
) => {
  const configObject = getTargetConfigObject(program, exportDefault);
  if (configObject) {
    return configObject;
  }
  const mergeConfigCall = getEffectiveMergeConfigCall(exportDefault.declaration, program);
  if (!mergeConfigCall || mergeConfigCall.arguments.length < 2) {
    return null;
  }
  const candidates = mergeConfigCall.arguments
    .map((arg) => getConfigObjectFromMergeArg(arg, program))
    .filter((object) => object !== null);
  return (
    candidates.find((object) => findNamedProp(object.properties, 'test')) ?? candidates[0] ?? null
  );
};

// Template imports and variables the target lacks, each with the comments that follow it.
const missingStatements = (source: SourceEditor, target: E.Program) => {
  const { body } = source.program;
  const declaresImport = (name: string) =>
    target.body.some(
      (node) =>
        node.type === 'ImportDeclaration' &&
        node.specifiers.some((specifier) => specifier.local.name === name)
    );
  const declaresVariable = (name: string) =>
    target.body.some(
      (node) =>
        node.type === 'VariableDeclaration' &&
        node.declarations.some((d) => d.id.type === 'Identifier' && d.id.name === name)
    );
  return body.flatMap((node, index) => {
    const text = source.code.slice(node.start, body[index + 1]?.start ?? source.code.length).trim();
    if (node.type === 'ImportDeclaration') {
      const name = node.specifiers[0]?.local.name;
      return name && !declaresImport(name) ? [text] : [];
    }
    if (node.type === 'VariableDeclaration') {
      const id = node.declarations[0]?.id;
      return id?.type === 'Identifier' && !declaresVariable(id.name) ? [text] : [];
    }
    return [];
  });
};

// Returns whether the config was updated; the edits are committed to `target` only when it was.
export const updateConfigFile = (sourceCode: string, target: SourceEditor): boolean => {
  const source = new SourceEditor(sourceCode);
  const templateConfig = () => {
    const declaration = findExportDefault(source.program)?.declaration;
    return declaration?.type === 'CallExpression' &&
      declaration.arguments[0]?.type === 'ObjectExpression'
      ? declaration.arguments[0]
      : null;
  };
  const exportDefault = findExportDefault(target.program);
  const targetConfig = exportDefault && findWritableConfigObject(target.program, exportDefault);
  if (!templateConfig() || !targetConfig) {
    return false;
  }

  const statements = missingStatements(source, target.program);
  if (statements.length > 0) {
    const lastImport = target.program.body.findLast((node) => node.type === 'ImportDeclaration');
    if (lastImport) {
      target.edits.appendLeft(lastImport.end, `\n${statements.join('\n')}`);
    } else {
      target.edits.appendLeft(target.program.body[0].start, `${statements.join('\n')}\n\n`);
    }
  }

  mergeTemplateIntoConfigObject({ source, target }, targetConfig, () => templateConfig()!);
  target.commit();
  return true;
};
