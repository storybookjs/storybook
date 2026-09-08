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
};

const storyTarget = ({ exportName, localName }: StoryBinding): CsfObjectTarget => ({
  kind: 'story',
  exportName,
  localName,
});

const addDirectBindings = (
  statement: NodePath<t.ExportNamedDeclaration>,
  bindings: Map<string, StoryBinding>
) => {
  const declaration = statement.get('declaration');
  if (declaration.isVariableDeclaration()) {
    for (const declarator of declaration.get('declarations')) {
      const id = declarator.get('id');
      if (id.isIdentifier()) {
        bindings.set(id.node.name, {
          exportName: id.node.name,
          localName: id.node.name,
          declaration: declarator,
        });
      }
    }
  } else if (declaration.isFunctionDeclaration() && declaration.node.id) {
    bindings.set(declaration.node.id.name, {
      exportName: declaration.node.id.name,
      localName: declaration.node.id.name,
      declaration,
    });
  }
};

const addAliasedBindings = (
  statement: NodePath<t.ExportNamedDeclaration>,
  bindings: Map<string, StoryBinding>,
  report: ReportDiagnostic
) => {
  if (statement.node.source) {
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
    const binding = specifier.scope.getBinding(localName);
    if (
      !binding?.constant ||
      (!binding.path.isVariableDeclarator() && !binding.path.isFunctionDeclaration())
    ) {
      report({
        code: 'ambiguous-binding',
        target: { kind: 'story', exportName, localName },
        path: [],
        message: `Cannot mutate ${exportName} because ${localName} is not a unique constant binding`,
        ...(specifier.node.loc ? { loc: specifier.node.loc } : {}),
      });
    } else if (!bindings.has(localName)) {
      bindings.set(localName, { exportName, localName, declaration: binding.path });
    }
  }
};

const storyBindings = (csf: CsfFile, report: ReportDiagnostic): StoryBinding[] => {
  const bindings = new Map<string, StoryBinding>();
  for (const statement of csf._file.path.get('body')) {
    if (!statement.isExportNamedDeclaration() || statement.node.exportKind === 'type') {
      continue;
    }
    addDirectBindings(statement, bindings);
    addAliasedBindings(statement, bindings, report);
  }
  return [...bindings.values()].filter(({ exportName }) => exportName in csf._stories);
};

const discoverMeta = (
  csf: CsfFile,
  report: ReportDiagnostic,
  markChanged: MarkChanged
): CsfObject[] => {
  const meta = metaObjectPath(csf);
  if (meta && !csf._metaIsFactory) {
    return [createCsfObject({ kind: 'meta' }, meta, [], report, markChanged)];
  }
  if (csf._metaIsFactory && csf._metaNode) {
    report({
      code: 'unsupported-initializer',
      target: { kind: 'meta' },
      path: [],
      message: 'Cannot mutate CSF factory meta automatically; move the field manually',
      ...(csf._metaNode.loc ? { loc: csf._metaNode.loc } : {}),
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
    const node = init.node && unwrapExpression(init.node);
    if (node && isCsfFactoryCall(node)) {
      report({
        code: 'unsupported-initializer',
        target: storyTarget(binding),
        path: [],
        message: `Cannot mutate CSF factory story ${binding.exportName} automatically; move the field manually`,
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
  if (!object.isIdentifier() || !property.isIdentifier() || left.node.computed) {
    return undefined;
  }
  const annotation =
    property.node.name === 'parameters'
      ? 'parameters'
      : property.node.name === 'story'
        ? 'story'
        : undefined;
  const binding = bindings.get(object.node.name);
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
    root: t.isObjectExpression(rootNode) ? pathForNode(csf._file.path, rootNode) : undefined,
    node: right.node,
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
      message: `Cannot mutate ${candidate.target.localName}.${candidate.annotation} because its value is not an object literal`,
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
  const bindings = storyBindings(csf, report);
  const annotations = new Set(options.annotations ?? []);
  return [
    ...((options.meta ?? true) ? discoverMeta(csf, report, markChanged) : []),
    ...((options.stories ?? true) ? discoverStories(csf, bindings, report, markChanged) : []),
    ...(annotations.size > 0
      ? discoverAnnotations(csf, bindings, annotations, report, markChanged)
      : []),
  ];
};
