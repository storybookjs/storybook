import { type NodePath, types as t } from 'storybook/internal/babel';

import type { CsfFile } from './CsfFile.ts';
import {
  type CsfMutationDiagnostic,
  type CsfObject,
  type CsfObjectOptions,
  type CsfObjectTarget,
  createCsfObject,
} from './CsfObject.ts';
import {
  isCsfFactoryCall,
  metaObjectPath,
  pathForNode,
  unwrapExpression,
} from './story-shape/index.ts';

type ReportDiagnostic = (diagnostic: CsfMutationDiagnostic) => void;
type MarkChanged = () => void;

type StoryBinding = {
  exportName: string;
  localName: string;
  declaration: NodePath<t.VariableDeclarator | t.FunctionDeclaration>;
};

type AnnotationCandidate = {
  target: Extract<CsfObjectTarget, { kind: 'story-annotation' }>;
  annotation: 'parameters' | 'story';
  root?: NodePath<t.ObjectExpression>;
  node: t.Node;
  message?: string;
};

const storyTarget = ({ exportName, localName }: StoryBinding): CsfObjectTarget => ({
  kind: 'story',
  exportName,
  localName,
});

const reportBindingFailure = (
  exportName: string,
  localName: string,
  node: t.Node,
  report: ReportDiagnostic
) =>
  report({
    code: 'ambiguous-binding',
    target: { kind: 'story', exportName, localName },
    path: [],
    message: `Cannot mutate ${exportName} because ${localName} is not a unique constant binding`,
    ...(node.loc ? { loc: node.loc } : {}),
  });

const addQualifiedBinding = (
  candidate: NodePath<t.Node>,
  exportName: string,
  localName: string,
  bindings: Map<string, StoryBinding>,
  report: ReportDiagnostic,
  isStory: boolean
) => {
  const binding = candidate.scope.getBinding(localName);
  if (
    !binding?.constant ||
    (!binding.path.isVariableDeclarator() && !binding.path.isFunctionDeclaration())
  ) {
    if (isStory) {
      reportBindingFailure(exportName, localName, candidate.node, report);
    }
  } else {
    bindings.set(`${localName}:${exportName}`, {
      exportName,
      localName,
      declaration: binding.path,
    });
  }
};

const addDirectBindings = (
  statement: NodePath<t.ExportNamedDeclaration>,
  bindings: Map<string, StoryBinding>,
  report: ReportDiagnostic,
  csf: CsfFile
) => {
  const declaration = statement.get('declaration');
  if (declaration.isVariableDeclaration()) {
    for (const declarator of declaration.get('declarations')) {
      const id = declarator.get('id');
      if (id.isIdentifier()) {
        addQualifiedBinding(
          id,
          id.node.name,
          id.node.name,
          bindings,
          report,
          id.node.name in csf._stories
        );
      }
    }
  } else if (declaration.isFunctionDeclaration() && declaration.node.id) {
    const name = declaration.node.id.name;
    addQualifiedBinding(declaration, name, name, bindings, report, name in csf._stories);
  }
};

const addAliasedBindings = (
  statement: NodePath<t.ExportNamedDeclaration>,
  bindings: Map<string, StoryBinding>,
  report: ReportDiagnostic,
  csf: CsfFile
) => {
  if (statement.node.source) {
    for (const specifier of statement.get('specifiers')) {
      if (!specifier.isExportSpecifier() || !t.isIdentifier(specifier.node.local)) {
        continue;
      }
      const exportName = t.isIdentifier(specifier.node.exported)
        ? specifier.node.exported.name
        : specifier.node.exported.value;
      if (exportName !== 'default' && exportName in csf._stories) {
        report({
          code: 'unsupported-initializer',
          target: { kind: 'story', exportName, localName: specifier.node.local.name },
          path: [],
          message: `Cannot mutate re-exported story ${exportName} automatically`,
          ...(specifier.node.loc ? { loc: specifier.node.loc } : {}),
        });
      }
    }
    return;
  }
  for (const specifier of statement.get('specifiers')) {
    if (!specifier.isExportSpecifier() || !t.isIdentifier(specifier.node.local)) {
      continue;
    }
    const exportName = t.isIdentifier(specifier.node.exported)
      ? specifier.node.exported.name
      : specifier.node.exported.value;
    if (exportName === 'default') {
      continue;
    }
    const localName = specifier.node.local.name;
    addQualifiedBinding(
      specifier,
      exportName,
      localName,
      bindings,
      report,
      exportName in csf._stories
    );
  }
};

const factoryMember = (node: t.Node | undefined): 'story' | 'extend' | undefined => {
  const unwrapped = node && unwrapExpression(node);
  if (!unwrapped || !t.isCallExpression(unwrapped) || !t.isMemberExpression(unwrapped.callee)) {
    return undefined;
  }
  const property = unwrapped.callee.property;
  if (unwrapped.callee.computed || !t.isIdentifier(property)) {
    return undefined;
  }
  return property.name === 'story' || property.name === 'extend' ? property.name : undefined;
};

const storyBindings = (csf: CsfFile, report: ReportDiagnostic): StoryBinding[] => {
  const bindings = new Map<string, StoryBinding>();
  for (const statement of csf._file.path.get('body')) {
    if (!statement.isExportNamedDeclaration() || statement.node.exportKind === 'type') {
      continue;
    }
    addDirectBindings(statement, bindings, report, csf);
    addAliasedBindings(statement, bindings, report, csf);
  }
  const candidates = [...bindings.values()].filter((binding) => binding.exportName in csf._stories);
  const unique = new Map<t.Node, StoryBinding>();
  for (const candidate of candidates) {
    const previous = unique.get(candidate.declaration.node);
    if (
      !previous ||
      (!(previous.exportName in csf._stories) && candidate.exportName in csf._stories)
    ) {
      unique.set(candidate.declaration.node, candidate);
    }
  }
  return [...unique.values()];
};

const isFactoryStory = (csf: CsfFile, node: t.Node, seen = new Set<string>()): boolean => {
  if (!isCsfFactoryCall(node)) {
    return false;
  }
  const receiver = node.callee.object.name;
  if (node.callee.property.name === 'story') {
    if (receiver !== csf._metaVariableName || !csf._metaFactoryCall) {
      return false;
    }
    const binding = csf._file.path.scope.getBinding(receiver);
    return (
      binding?.constant === true &&
      binding.path.isVariableDeclarator() &&
      t.isExpression(binding.path.node.init) &&
      unwrapExpression(binding.path.node.init) === csf._metaFactoryCall
    );
  }
  if (seen.has(receiver)) {
    return false;
  }
  seen.add(receiver);
  const binding = csf._file.path.scope.getBinding(receiver);
  const initializer =
    binding?.constant && binding.path.isVariableDeclarator() ? binding.path.node.init : undefined;
  return initializer ? isFactoryStory(csf, unwrapExpression(initializer), seen) : false;
};

const factoryMetaConfigurationIsSafe = (csf: CsfFile): boolean => {
  const argument = csf._metaFactoryCall?.arguments[0];
  if (!argument || !t.isIdentifier(argument)) {
    return true;
  }
  const binding = csf._file.path.scope.getBinding(argument.name);
  if (!binding?.constant || !binding.path.isVariableDeclarator()) {
    return false;
  }
  const initializer = binding.path.node.init;
  if (!initializer || !t.isObjectExpression(unwrapExpression(initializer))) {
    return false;
  }
  return binding.referencePaths.every((reference) => unwrapExpression(argument) === reference.node);
};

const discoverMeta = (
  csf: CsfFile,
  report: ReportDiagnostic,
  markChanged: MarkChanged
): CsfObject[] => {
  if (csf._metaIsFactory && csf._metaFactoryCall && !factoryMetaConfigurationIsSafe(csf)) {
    report({
      code: 'unsupported-initializer',
      target: { kind: 'meta' },
      path: [],
      message: 'Cannot mutate CSF factory meta with an identifier-backed configuration',
      ...(csf._metaFactoryCall.loc ? { loc: csf._metaFactoryCall.loc } : {}),
    });
    return [];
  }
  const meta = metaObjectPath(csf);
  if (meta) {
    const binding = csf._metaVariableName
      ? meta.scope.getBinding(csf._metaVariableName)
      : undefined;
    if (binding && !binding.constant) {
      report({
        code: 'ambiguous-binding',
        target: { kind: 'meta' },
        path: [],
        message: `Cannot mutate meta because ${csf._metaVariableName} is not a unique constant binding`,
        ...(binding.path.node.loc ? { loc: binding.path.node.loc } : {}),
      });
      return [];
    }
    return [createCsfObject({ kind: 'meta' }, meta, [], report, markChanged)];
  }
  if (csf._metaIsFactory && csf._metaFactoryCall) {
    report({
      code: 'unsupported-initializer',
      target: { kind: 'meta' },
      path: [],
      message: 'Cannot mutate CSF factory meta automatically; move the field manually',
      ...(csf._metaFactoryCall.loc ? { loc: csf._metaFactoryCall.loc } : {}),
    });
  }
  return [];
};

const discoverStories = (
  csf: CsfFile,
  bindings: StoryBinding[],
  report: ReportDiagnostic,
  markChanged: MarkChanged
): CsfObject[] =>
  bindings.flatMap((binding) => {
    const declaration = binding.declaration;
    const init = declaration.isVariableDeclarator() ? declaration.get('init') : declaration;
    const node = init.node ? unwrapExpression(init.node) : undefined;
    if (node && factoryMember(node)) {
      const argument = t.isCallExpression(node) ? node.arguments[0] : undefined;
      const argumentNode =
        argument && t.isExpression(argument) ? unwrapExpression(argument) : undefined;
      if (
        t.isCallExpression(node) &&
        isFactoryStory(csf, node) &&
        node.arguments.length === 1 &&
        argumentNode &&
        t.isObjectExpression(argumentNode)
      ) {
        const root = pathForNode(csf._file.path, argumentNode);
        return root ? [createCsfObject(storyTarget(binding), root, [], report, markChanged)] : [];
      }
      report({
        code: 'unsupported-initializer',
        target: storyTarget(binding),
        path: [],
        message: `Cannot mutate CSF factory story ${binding.exportName} because its configuration is not an inline object literal`,
        ...(node.loc ? { loc: node.loc } : {}),
      });
      return [];
    }
    const expression = init.isExpression() ? init : undefined;
    const unwrapped = expression && unwrapExpression(expression.node);
    const root =
      unwrapped && t.isObjectExpression(unwrapped)
        ? pathForNode(csf._file.path, unwrapped)
        : undefined;
    return root ? [createCsfObject(storyTarget(binding), root, [], report, markChanged)] : [];
  });

const annotationCandidate = (
  csf: CsfFile,
  statement: NodePath<t.Statement>,
  bindings: Map<string, StoryBinding>,
  annotations: Set<'parameters' | 'story'>
): AnnotationCandidate | undefined => {
  if (!statement.isExpressionStatement()) {
    return undefined;
  }
  const expression = statement.get('expression');
  if (!expression.isAssignmentExpression()) {
    return undefined;
  }
  const left = expression.get('left');
  const right = expression.get('right');
  if (!left.isMemberExpression() || !right.isExpression()) {
    return undefined;
  }
  const object = left.get('object');
  const property = left.get('property');
  if (!object.isIdentifier()) {
    return undefined;
  }
  const propertyName =
    !left.node.computed && property.isIdentifier()
      ? property.node.name
      : left.node.computed && property.isStringLiteral()
        ? property.node.value
        : undefined;
  const binding = bindings.get(object.node.name);
  if (!propertyName && left.node.computed && binding && annotations.size > 0) {
    const annotation = annotations.has('parameters') ? 'parameters' : 'story';
    return {
      target: {
        kind: 'story-annotation',
        exportName: binding.exportName,
        localName: binding.localName,
        annotation,
      },
      annotation,
      node: property.node,
      message: `Cannot mutate ${binding.localName} annotation because its computed name is not a static string literal`,
    };
  }
  if (!propertyName) {
    return undefined;
  }
  const annotation =
    propertyName === 'parameters' ? 'parameters' : propertyName === 'story' ? 'story' : undefined;
  if (!annotation || !binding || !annotations.has(annotation)) {
    return undefined;
  }
  const rootNode = unwrapExpression(right.node);
  return {
    target: {
      kind: 'story-annotation',
      exportName: binding.exportName,
      localName: binding.localName,
      annotation,
    },
    annotation,
    root:
      expression.node.operator === '=' && t.isObjectExpression(rootNode)
        ? pathForNode(csf._file.path, rootNode)
        : undefined,
    node: right.node,
    ...(expression.node.operator === '='
      ? {}
      : {
          message: `Cannot mutate ${binding.localName}.${annotation} because it uses ${expression.node.operator} assignment`,
        }),
  };
};

const reportOrCreateAnnotation = (
  matches: AnnotationCandidate[],
  report: ReportDiagnostic,
  markChanged: MarkChanged
): CsfObject[] => {
  const [candidate] = matches;
  if (matches.length > 1) {
    report({
      code: 'ambiguous-binding',
      target: candidate.target,
      path: [candidate.annotation],
      message: `Cannot mutate repeated ${candidate.target.localName}.${candidate.annotation} assignments`,
      ...(candidate.node.loc ? { loc: candidate.node.loc } : {}),
    });
    return [];
  }
  if (!candidate.root) {
    report({
      code: 'unsupported-initializer',
      target: candidate.target,
      path: [candidate.annotation],
      message:
        candidate.message ??
        `Cannot mutate ${candidate.target.localName}.${candidate.annotation} because its value is not an object literal`,
      ...(candidate.node.loc ? { loc: candidate.node.loc } : {}),
    });
    return [];
  }
  return [
    createCsfObject(candidate.target, candidate.root, [candidate.annotation], report, markChanged),
  ];
};

const discoverAnnotations = (
  csf: CsfFile,
  storyBindings: StoryBinding[],
  annotations: Set<'parameters' | 'story'>,
  report: ReportDiagnostic,
  markChanged: MarkChanged
): CsfObject[] => {
  const bindings = new Map(storyBindings.map((binding) => [binding.localName, binding]));
  const candidates = new Map<string, AnnotationCandidate[]>();
  for (const statement of csf._file.path.get('body')) {
    const candidate = annotationCandidate(csf, statement, bindings, annotations);
    if (candidate) {
      const identity = `${candidate.target.localName}:${candidate.annotation}`;
      candidates.set(identity, [...(candidates.get(identity) ?? []), candidate]);
    }
  }
  return [...candidates.values()].flatMap((matches) =>
    reportOrCreateAnnotation(matches, report, markChanged)
  );
};

export const discoverCsfObjects = (
  csf: CsfFile,
  options: CsfObjectOptions,
  report: ReportDiagnostic,
  markChanged: MarkChanged
): readonly CsfObject[] => {
  const annotations = new Set(options.annotations ?? []);
  const includeStories = options.stories ?? true;
  const bindings = includeStories || annotations.size > 0 ? storyBindings(csf, report) : [];
  return [
    ...((options.meta ?? true) ? discoverMeta(csf, report, markChanged) : []),
    ...(includeStories ? discoverStories(csf, bindings, report, markChanged) : []),
    ...(annotations.size > 0
      ? discoverAnnotations(csf, bindings, annotations, report, markChanged)
      : []),
  ];
};
