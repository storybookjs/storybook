import type { CsfFile } from './CsfFile.ts';
import { csfFactoryReceiver, isCsfFactoryCall, withoutTypeCalls } from './CsfFile.ts';
import {
  type CsfMutationDiagnostic,
  type CsfObject,
  type CsfObjectHost,
  type CsfObjectOptions,
  type CsfObjectTarget,
  createCsfObject,
  literalRoot,
} from './CsfObject.ts';
import { type E, type Node, isStringLiteral, locationOf, unwrapExpression } from './estree/ast.ts';
import type { Binding } from './estree/scope.ts';

type ReportDiagnostic = (diagnostic: CsfMutationDiagnostic) => void;
type MarkChanged = () => void;

type StoryBinding = {
  exportName: string;
  localName: string;
  declaration: E.VariableDeclarator | E.Function;
};

type AnnotationCandidate = {
  target: Extract<CsfObjectTarget, { kind: 'story-annotation' }>;
  annotation: 'parameters';
  root?: E.ObjectExpression;
  node: Node;
  message?: string;
};

// An object literal an editor works on, before it is wrapped into a `CsfObject`.
type Discovered = { target: CsfObjectTarget; prefix: readonly string[]; node: E.ObjectExpression };

const loc = (csf: CsfFile, node: Node) => {
  const span = node as Node & { start: number; end: number };
  return { loc: locationOf(csf._code, span.start, span.end) };
};

const storyTarget = ({ exportName, localName }: StoryBinding): CsfObjectTarget => ({
  kind: 'story',
  exportName,
  localName,
});

const exportedName = (node: E.ModuleExportName) =>
  node.type === 'Identifier' ? node.name : (node as E.StringLiteral).value;

const addQualifiedBinding = (
  csf: CsfFile,
  node: Node,
  exportName: string,
  localName: string,
  bindings: Map<string, StoryBinding>,
  report: ReportDiagnostic,
  isStory: boolean
) => {
  const binding = csf._editor.scopes.program.bindings.get(localName);
  if (
    !binding?.constant ||
    (binding.node.type !== 'VariableDeclarator' && binding.node.type !== 'FunctionDeclaration')
  ) {
    if (isStory) {
      report({
        code: 'ambiguous-binding',
        target: { kind: 'story', exportName, localName },
        path: [],
        message: `Cannot mutate ${exportName} because ${localName} is not a unique constant binding`,
        ...loc(csf, node),
      });
    }
  } else {
    bindings.set(`${localName}:${exportName}`, {
      exportName,
      localName,
      declaration: binding.node as E.VariableDeclarator | E.Function,
    });
  }
};

const storyBindings = (csf: CsfFile, report: ReportDiagnostic): StoryBinding[] => {
  const bindings = new Map<string, StoryBinding>();
  for (const statement of csf._program.body) {
    if (statement.type !== 'ExportNamedDeclaration' || statement.exportKind === 'type') {
      continue;
    }
    const { declaration } = statement;
    if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === 'Identifier') {
          const { name } = declarator.id;
          addQualifiedBinding(
            csf,
            declarator.id,
            name,
            name,
            bindings,
            report,
            name in csf._stories
          );
        }
      }
    } else if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
      const { name } = declaration.id;
      addQualifiedBinding(csf, declaration, name, name, bindings, report, name in csf._stories);
    }
    for (const specifier of statement.specifiers) {
      if (specifier.local.type !== 'Identifier') {
        continue;
      }
      const exportName = exportedName(specifier.exported);
      if (statement.source) {
        if (exportName !== 'default' && exportName in csf._stories) {
          report({
            code: 'unsupported-initializer',
            target: { kind: 'story', exportName, localName: specifier.local.name },
            path: [],
            message: `Cannot mutate re-exported story ${exportName} automatically`,
            ...loc(csf, specifier),
          });
        }
        continue;
      }
      if (exportName === 'default') {
        continue;
      }
      addQualifiedBinding(
        csf,
        specifier,
        exportName,
        specifier.local.name,
        bindings,
        report,
        exportName in csf._stories
      );
    }
  }
  const candidates = [...bindings.values()].filter((binding) => binding.exportName in csf._stories);
  const unique = new Map<Node, StoryBinding>();
  for (const candidate of candidates) {
    if (!unique.has(candidate.declaration)) {
      unique.set(candidate.declaration, candidate);
    }
  }
  return [...unique.values()];
};

const variableInit = (binding: Binding | undefined) =>
  binding?.constant && binding.node.type === 'VariableDeclarator' ? binding.node.init : undefined;

const factoryMember = (node: Node | null | undefined): 'story' | 'extend' | undefined => {
  const unwrapped = node && unwrapExpression(node);
  if (unwrapped?.type !== 'CallExpression' || unwrapped.callee.type !== 'MemberExpression') {
    return undefined;
  }
  const property = unwrapped.callee.property;
  if (unwrapped.callee.computed || property.type !== 'Identifier') {
    return undefined;
  }
  return property.name === 'story' || property.name === 'extend' ? property.name : undefined;
};

const isFactoryMeta = (csf: CsfFile, name: string, seen = new Set<string>()): boolean => {
  const init = variableInit(csf._editor.scopes.program.bindings.get(name));
  if (seen.has(name) || !csf._metaFactoryCall || !init) {
    return false;
  }
  seen.add(name);
  const initializer = withoutTypeCalls(unwrapExpression(init));
  return (
    initializer === csf._metaFactoryCall ||
    (initializer.type === 'Identifier' && isFactoryMeta(csf, initializer.name, seen))
  );
};

const isFactoryStory = (csf: CsfFile, node: Node, seen = new Set<string>()): boolean => {
  if (!isCsfFactoryCall(node)) {
    return false;
  }
  const receiver = csfFactoryReceiver(node).name;
  if (node.callee.property.name === 'story') {
    return isFactoryMeta(csf, receiver);
  }
  if (seen.has(receiver)) {
    return false;
  }
  seen.add(receiver);
  const initializer = variableInit(csf._editor.scopes.program.bindings.get(receiver));
  return initializer ? isFactoryStory(csf, unwrapExpression(initializer), seen) : false;
};

const factoryMetaConfigurationIsSafe = (csf: CsfFile): boolean => {
  const argument = csf._metaFactoryCall?.arguments[0];
  if (argument?.type !== 'Identifier') {
    return true;
  }
  const binding = csf._editor.scopes.program.bindings.get(argument.name);
  if (
    !binding?.constant ||
    binding.node.type !== 'VariableDeclarator' ||
    binding.declaration?.type !== 'VariableDeclaration' ||
    binding.declaration.kind !== 'const'
  ) {
    return false;
  }
  const initializer = binding.node.init;
  if (!initializer || unwrapExpression(initializer).type !== 'ObjectExpression') {
    return false;
  }
  return binding.references.length === 1 && binding.references[0] === argument;
};

const discoverMeta = (csf: CsfFile, report: ReportDiagnostic): Discovered[] => {
  if (csf._metaIsFactory && csf._metaFactoryCall && !factoryMetaConfigurationIsSafe(csf)) {
    report({
      code: 'unsupported-initializer',
      target: { kind: 'meta' },
      path: [],
      message: 'Cannot mutate CSF factory meta with an identifier-backed configuration',
      ...loc(csf, csf._metaFactoryCall),
    });
    return [];
  }
  if (csf._metaNode && !csf._metaNodeIsSynthetic) {
    const binding = csf._metaVariableName
      ? csf._editor.scopes.program.bindings.get(csf._metaVariableName)
      : undefined;
    if (binding && !binding.constant) {
      report({
        code: 'ambiguous-binding',
        target: { kind: 'meta' },
        path: [],
        message: `Cannot mutate meta because ${csf._metaVariableName} is not a unique constant binding`,
        ...loc(csf, binding.node),
      });
      return [];
    }
    return [{ target: { kind: 'meta' }, prefix: [], node: csf._metaNode }];
  }
  if (csf._metaIsFactory && csf._metaFactoryCall) {
    report({
      code: 'unsupported-initializer',
      target: { kind: 'meta' },
      path: [],
      message: 'Cannot mutate CSF factory meta automatically; move the field manually',
      ...loc(csf, csf._metaFactoryCall),
    });
  }
  return [];
};

const discoverStories = (
  csf: CsfFile,
  bindings: StoryBinding[],
  report: ReportDiagnostic
): Discovered[] =>
  bindings.flatMap((binding): Discovered[] => {
    const { declaration } = binding;
    const init = declaration.type === 'VariableDeclarator' ? declaration.init : declaration;
    const node = init ? unwrapExpression(init as Node) : undefined;
    if (node && factoryMember(node)) {
      const argument = node.type === 'CallExpression' ? node.arguments[0] : undefined;
      const argumentNode =
        argument && argument.type !== 'SpreadElement' ? unwrapExpression(argument) : undefined;
      if (
        node.type === 'CallExpression' &&
        isFactoryStory(csf, node) &&
        node.arguments.length === 1 &&
        argumentNode?.type === 'ObjectExpression'
      ) {
        return [{ target: storyTarget(binding), prefix: [], node: argumentNode }];
      }
      report({
        code: 'unsupported-initializer',
        target: storyTarget(binding),
        path: [],
        message: `Cannot mutate CSF factory story ${binding.exportName} because its configuration is not an inline object literal`,
        ...loc(csf, node),
      });
      return [];
    }
    return node?.type === 'ObjectExpression'
      ? [{ target: storyTarget(binding), prefix: [], node }]
      : [];
  });

const annotationCandidates = (
  statement: Node,
  bindings: Map<string, StoryBinding>
): AnnotationCandidate[] => {
  if (statement.type !== 'ExpressionStatement') {
    return [];
  }
  const { expression } = statement;
  if (expression.type !== 'AssignmentExpression') {
    return [];
  }
  const { left, right } = expression;
  if (left.type !== 'MemberExpression' || left.object.type !== 'Identifier') {
    return [];
  }
  const property = left.property;
  const propertyName =
    !left.computed && property.type === 'Identifier'
      ? property.name
      : left.computed && isStringLiteral(property)
        ? property.value
        : undefined;
  const binding = bindings.get(left.object.name);
  if (!propertyName && left.computed && binding) {
    return [
      {
        target: {
          kind: 'story-annotation',
          exportName: binding.exportName,
          localName: binding.localName,
          annotation: 'parameters',
        },
        annotation: 'parameters',
        node: property,
        message: `Cannot mutate ${binding.localName} annotation because its computed name is not a static string literal`,
      },
    ];
  }
  if (propertyName !== 'parameters' || !binding) {
    return [];
  }
  const rootNode = unwrapExpression(right);
  return [
    {
      target: {
        kind: 'story-annotation',
        exportName: binding.exportName,
        localName: binding.localName,
        annotation: 'parameters',
      },
      annotation: 'parameters',
      root:
        expression.operator === '=' && rootNode.type === 'ObjectExpression' ? rootNode : undefined,
      node: right,
      ...(expression.operator === '='
        ? {}
        : {
            message: `Cannot mutate ${binding.localName}.parameters because it uses ${expression.operator} assignment`,
          }),
    },
  ];
};

const discoverAnnotations = (
  csf: CsfFile,
  storyBindings: StoryBinding[],
  report: ReportDiagnostic
): Discovered[] => {
  const bindings = new Map(storyBindings.map((binding) => [binding.localName, binding]));
  const candidates = new Map<string, AnnotationCandidate[]>();
  for (const statement of csf._program.body) {
    for (const candidate of annotationCandidates(statement, bindings)) {
      const identity = `${candidate.target.localName}:${candidate.annotation}`;
      candidates.set(identity, [...(candidates.get(identity) ?? []), candidate]);
    }
  }
  return [...candidates.values()].flatMap((matches): Discovered[] => {
    const [candidate] = matches;
    if (matches.length > 1) {
      report({
        code: 'ambiguous-binding',
        target: candidate.target,
        path: [candidate.annotation],
        message: `Cannot mutate repeated ${candidate.target.localName}.${candidate.annotation} assignments`,
        ...loc(csf, candidate.node),
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
        ...loc(csf, candidate.node),
      });
      return [];
    }
    return [{ target: candidate.target, prefix: [candidate.annotation], node: candidate.root }];
  });
};

const discover = (
  csf: CsfFile,
  options: CsfObjectOptions,
  report: ReportDiagnostic
): Discovered[] => {
  const includeStories = options.stories ?? true;
  const bindings = includeStories ? storyBindings(csf, report) : [];
  return [
    ...((options.meta ?? true) ? discoverMeta(csf, report) : []),
    ...(includeStories ? discoverStories(csf, bindings, report) : []),
    ...(includeStories ? discoverAnnotations(csf, bindings, report) : []),
  ];
};

const sameTarget = (a: CsfObjectTarget, b: CsfObjectTarget) =>
  JSON.stringify(a) === JSON.stringify(b);

export const discoverCsfObjects = (
  csf: CsfFile,
  options: CsfObjectOptions,
  report: ReportDiagnostic,
  markChanged: MarkChanged
): readonly CsfObject[] =>
  discover(csf, options, report).map(({ target, prefix }) => {
    const host: CsfObjectHost = {
      editor: csf._editor,
      root: () => {
        // Edits re-parse the file, so the object is found again by its target.
        const current = discover(csf, options, () => {}).find((candidate) =>
          sameTarget(candidate.target, target)
        );
        return current && literalRoot(csf._editor, current.node);
      },
      commit: () => csf._commit(),
    };
    return createCsfObject(target, host, prefix, report, markChanged);
  });
