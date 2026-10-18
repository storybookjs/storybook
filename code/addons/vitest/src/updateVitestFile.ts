import { isBuiltin } from 'node:module';

import {
  findExportDefault,
  getConfigObjectFromMergeArg,
  getEffectiveMergeConfigCall,
  getTargetConfigObject,
  resolveExpression,
} from 'storybook/internal/cli';
import {
  type Binding,
  type ESTree as E,
  SourceEditor,
  appendToList,
  arrayList,
  insertAfterImports,
  itemText,
  lineIndent,
  reindent,
  objectList,
  prependToList,
  printMembers,
  statementSpan,
  staticKey,
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

// A method or accessor has no value expression to merge.
const findNamedProp = (members: Member[], name: string) =>
  members.find(
    (member): member is E.ObjectProperty =>
      member.type === 'Property' &&
      !member.method &&
      member.kind === 'init' &&
      staticKey(member) === name
  );

const isProjectsArrayProp = (
  member: Member
): member is E.ObjectProperty & { value: E.ArrayExpression } =>
  staticKey(member) === 'projects' && (member as E.ObjectProperty).value.type === 'ArrayExpression';

const memberTexts = (editor: SourceEditor, object: E.ObjectExpression, members: Member[]) =>
  members.map((member) => itemText(editor, objectList(editor, object), member));

const elementTexts = (editor: SourceEditor, array: E.ArrayExpression) =>
  arrayList(editor, array).items.map((element) =>
    itemText(editor, arrayList(editor, array), element)
  );

// Nested objects are merged, arrays concatenated, other values overwritten.
const mergeProperties = (
  { source, target }: Merge,
  from: E.ObjectExpression,
  into: E.ObjectExpression,
  fromMembers: Member[] = from.properties
) => {
  const appended: string[] = [];
  for (const sourceProp of fromMembers) {
    const name = staticKey(sourceProp);
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
      appendToList(target, arrayList(target, targetValue), elementTexts(source, sourceValue));
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
    appendToList(target, objectList(target, into), appended);
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
      appendToList(
        merge.target,
        arrayList(merge.target, existingProjects),
        elementTexts(merge.source, templateProjects.value)
      );
    }
    const existingNames = new Set(testObject.properties.map(staticKey));
    const added = templateTestObject.properties.filter((member) => {
      const name = staticKey(member);
      return name !== undefined && name !== 'projects' && !existingNames.has(name);
    });
    if (added.length > 0) {
      appendToList(
        merge.target,
        objectList(merge.target, testObject),
        memberTexts(merge.source, templateTestObject, added)
      );
    }
  }

  mergeProperties(
    merge,
    templateConfig,
    targetConfig,
    templateConfig.properties.filter((member) => staticKey(member) !== 'test')
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
  const projectTest = printMembers(memberTexts(target, testObject, projectMembers), source.indent);
  const project = printMembers(['extends: true', `test: ${projectTest}`], source.indent);

  prependToList(source, arrayList(source, templateProjects.value), [project]);
  if (hoisted.length > 0) {
    prependToList(
      source,
      objectList(source, templateTestObject),
      memberTexts(target, testObject, hoisted)
    );
  }
  source.commit();

  const config = templateConfig();
  const templateTest = findNamedProp(config.properties, 'test')!;
  target.edits.overwrite(
    existingTest.start,
    existingTest.end,
    reindent(
      itemText(source, objectList(source, config), templateTest),
      '',
      lineIndent(target.code, existingTest.start)
    )
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

// The export an import binding reads. `node:path` and `path` are one module, and the default
// export of a Node builtin is the same object as its namespace.
const importedExport = (binding: Binding) => {
  if (binding.kind !== 'import' || binding.declaration?.type !== 'ImportDeclaration') {
    return undefined;
  }
  const specifier = binding.node as E.ImportDeclarationSpecifier;
  const source = binding.declaration.source.value.replace(/^node:/, '');
  const name =
    specifier.type === 'ImportNamespaceSpecifier'
      ? '*'
      : specifier.type === 'ImportDefaultSpecifier'
        ? 'default'
        : specifier.imported.type === 'Literal'
          ? specifier.imported.value
          : specifier.imported.name;
  return `${name === 'default' && isBuiltin(source) ? '*' : name} from ${source}`;
};

// Whether the target binds a name the merged template code reads to anything but the same import.
const hasConflictingBinding = (source: SourceEditor, target: SourceEditor, at: E.Node) => {
  const scope = target.scopes.scopeOf(at);
  // The template's own `defineConfig(...)` call is not merged.
  const call = findExportDefault(source.program)?.declaration as E.CallExpression;
  return [...source.scopes.program.bindings.values()].some((binding) => {
    const existing = scope.lookup(binding.name);
    const merged = binding.references.some((reference) => reference !== call.callee);
    const imported = importedExport(binding);
    return merged && existing && (!imported || importedExport(existing) !== imported);
  });
};

// Template imports and variables the target lacks, each with the comments it owns.
const missingStatements = (source: SourceEditor, target: SourceEditor) => {
  // Any top-level binding counts, so a name the config declares in another form is not declared
  // a second time.
  const declared = (name: string) => target.scopes.program.bindings.has(name);
  return source.program.body.flatMap((node) => {
    const text = source.source(statementSpan(source, node));
    if (node.type === 'ImportDeclaration') {
      const name = node.specifiers[0]?.local.name;
      return name && !declared(name) ? [text] : [];
    }
    if (node.type === 'VariableDeclaration') {
      const id = node.declarations[0]?.id;
      return id?.type === 'Identifier' && !declared(id.name) ? [text] : [];
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
  if (!templateConfig() || !targetConfig || hasConflictingBinding(source, target, targetConfig)) {
    return false;
  }

  const statements = missingStatements(source, target);
  if (statements.length > 0) {
    // After the imports, so the config never reads a variable before it is declared.
    insertAfterImports(target, statements.join('\n'));
  }

  mergeTemplateIntoConfigObject({ source, target }, targetConfig, () => templateConfig()!);
  target.commit();
  return true;
};
