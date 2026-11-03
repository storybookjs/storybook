import {
  type ESTree as E,
  type ESTreeNode as Node,
  type ImportBinding,
  type ImportRef,
  SourceEditor,
  buildImportStatements,
  detachedTextOf,
  resolveComponentImport,
  textOf,
  walk as walkEstree,
} from 'storybook/internal/csf-tools';
import { walk } from 'zimmerframe';

import type { SvelteAST } from '../../svelte-csf/parser/ast.ts';
import { parseMarkup, patternNames, scriptFile, span } from './markup.ts';

export interface SnippetImportBlock {
  block?: string;
  // Names the block declares, by import or by a copied declaration.
  declared: string[];
  // Components the snippet renders that nothing in the story file declares.
  unresolved: string[];
  // Other names the snippet reads that nothing in the story file declares.
  unresolvedIdentifiers?: string[];
}

// Names a snippet can read without declaring them: runes, and browser globals that the Node
// process building the snippet does not have.
const GLOBALS = new Set([
  '$state',
  '$derived',
  '$effect',
  '$props',
  '$bindable',
  '$inspect',
  '$host',
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'alert',
  'confirm',
  'prompt',
  'requestAnimationFrame',
  'cancelAnimationFrame',
]);

const SVELTE_NODE =
  /^(?:Root|Fragment|Text|Comment|ExpressionTag|HtmlTag|ConstTag|DebugTag|RenderTag|AttachTag|Attribute|SpreadAttribute|\w+Directive|Component|RegularElement|Svelte\w+|TitleElement|SlotElement|\w+Block)$/;

// Build the `<script>` block a snippet needs to compile on its own: the imports of the components
// and values it uses, and the story file declarations it reads, with their dependencies.
// Names resolve the way Svelte scopes them: the instance script first, then the module script, then
// the story file's imports (`bindings`).
export function buildSnippetImportBlock(
  markup: string,
  {
    bindings,
    importOverride,
    instanceScript,
    moduleScript,
    imports = [],
    typescript = false,
  }: {
    bindings: Map<string, ImportBinding>;
    // The `@import` of the meta, which replaces the import of the meta component only.
    importOverride?: { name: string; statement: string };
    instanceScript?: string;
    moduleScript?: string;
    // Imports the printed arg values need.
    imports?: ImportRef[];
    typescript?: boolean;
  }
): SnippetImportBlock {
  const { components, names } = markupReferences(markup, typescript);
  const scripts = [instanceScript, moduleScript].map((code) =>
    code === undefined ? undefined : readScript(code, typescript)
  );
  const storyImports = new Set<string>();
  const unresolved = new Set<string>();
  const declaredNames = new Set<string>();

  // A type that nothing in the story file declares comes from the TypeScript libraries.
  const visit = (name: string, level = 0, type = false): void => {
    const script = scripts[level];
    if (level < scripts.length) {
      const found = script?.declarations.get(name);
      if (!found) return visit(name, level + 1, type);
      declaredNames.add(name);
      if (found.kind === 'import' && level === 1) {
        storyImports.add(name);
        return;
      }
      if (script!.selected.has(found)) return;
      script!.selected.add(found);
      for (const dependency of found.dependencies.values) visit(dependency, level);
      for (const dependency of found.dependencies.types) visit(dependency, level, true);
      return;
    }
    if (bindings.has(name)) {
      storyImports.add(name);
      declaredNames.add(name);
    } else if (!type && !GLOBALS.has(name) && !(name in globalThis)) unresolved.add(name);
  };
  // `$count` reads the store `count`; runes start with `$` too, and are globals.
  for (const name of [...components, ...names.values]) {
    const base = name.split('.')[0];
    visit(base.startsWith('$') && !GLOBALS.has(base) ? base.slice(1) : base);
  }
  for (const name of names.types) visit(name, 0, true);

  const importLines = buildImportStatements({
    refs: [
      ...[...storyImports].map((name) => {
        const ref = resolveComponentImport(name, bindings);
        return {
          ...ref,
          ...(name === importOverride?.name ? { importOverride: importOverride.statement } : {}),
        };
      }),
      ...imports,
    ],
  });
  const [instance, module] = scripts.map((script) => (script ? printSelected(script) : []));
  const copies = scripts.some((script) =>
    [...(script?.selected ?? [])].some((found) => found.kind === 'declaration')
  );
  const lang = typescript && (copies || needsTypeScript(markup)) ? ' lang="ts"' : '';
  const blocks =
    module.length && instance.length
      ? [scriptBlock(` module${lang}`, [importLines, module]), scriptBlock(lang, [instance])]
      : [scriptBlock(lang, [importLines, module, instance])];

  const unresolvedComponents = [...components].filter((name) => unresolved.has(name.split('.')[0]));
  for (const name of unresolvedComponents) unresolved.delete(name.split('.')[0]);
  const printed = blocks.filter((block) => block !== undefined);
  return {
    ...(printed.length ? { block: printed.join('\n\n') } : {}),
    declared: [...declaredNames],
    unresolved: unresolvedComponents,
    ...(unresolved.size ? { unresolvedIdentifiers: [...unresolved] } : {}),
  };
}

function needsTypeScript(markup: string): boolean {
  try {
    parseMarkup(markup, false);
    return false;
  } catch {
    return true;
  }
}

function scriptBlock(attributes: string, groups: string[][]): string | undefined {
  const lines = groups
    .filter((group) => group.length)
    .flatMap((group, index) => (index ? ['', ...group] : group));
  if (!lines.length) return undefined;
  const body = lines
    .flatMap((line) => line.split('\n'))
    .map((line) => (line ? `  ${line}` : ''))
    .join('\n');
  return `<script${attributes}>\n${body}\n</script>`;
}

// The components and the other free names the markup reads.
function markupReferences(markup: string, typescript: boolean) {
  const { ast, offset } = parseMarkup(markup, typescript);
  const components = new Set<string>();
  const names = { values: new Set<string>(), types: new Set<string>() };
  const read = (node: object, local: Set<string>) => {
    const { start, end } = span(node);
    const code = markup.slice(start - offset, end - offset);
    const free = freeNames(code, 'type' in node && node.type === 'VariableDeclaration', typescript);
    for (const name of free.values) if (!local.has(name)) names.values.add(name);
    for (const name of free.types) names.types.add(name);
  };

  walk<SvelteAST.SvelteNode, Set<string>>(ast.fragment, new Set(), {
    _(node, { state, next }) {
      if (SVELTE_NODE.test(node.type)) return next();
      // The outermost ESTree node is the whole expression; read it once, as one unit.
      read(node, state);
    },
    Fragment(node, { state, next }) {
      const declared = node.nodes.flatMap((child) =>
        child.type === 'ConstTag'
          ? child.declaration.declarations.flatMap((declaration) => patternNames(declaration.id))
          : child.type === 'SnippetBlock'
            ? [child.expression.name]
            : []
      );
      next(declared.length ? new Set([...state, ...declared]) : state);
    },
    EachBlock(node, { state, visit }) {
      visit(node.expression, state);
      const local = new Set([
        ...state,
        ...patternNames(node.context),
        ...(node.index ? [node.index] : []),
      ]);
      if (node.key) visit(node.key, local);
      visit(node.body, local);
      if (node.fallback) visit(node.fallback, state);
    },
    AwaitBlock(node, { state, visit }) {
      visit(node.expression, state);
      if (node.pending) visit(node.pending, state);
      if (node.then) visit(node.then, new Set([...state, ...patternNames(node.value)]));
      if (node.catch) visit(node.catch, new Set([...state, ...patternNames(node.error)]));
    },
    SnippetBlock(node, { state, visit }) {
      visit(node.body, new Set([...state, ...node.parameters.flatMap(patternNames)]));
    },
    ConstTag(node, { state }) {
      for (const declaration of node.declaration.declarations) {
        if (declaration.init) read(declaration.init, state);
      }
    },
    Component(node, { state, visit }) {
      if (!state.has(node.name.split('.')[0])) components.add(node.name);
      visitElement(node, state, visit);
    },
    RegularElement(node, { state, visit }) {
      visitElement(node, state, visit);
    },
    SvelteComponent(node, { state, visit }) {
      visitElement(node, state, visit);
    },
    SvelteElement(node, { state, visit }) {
      visitElement(node, state, visit);
    },
    UseDirective(node, { state, next }) {
      addName(node.name, state);
      next();
    },
    TransitionDirective(node, { state, next }) {
      addName(node.name, state);
      next();
    },
    AnimateDirective(node, { state, next }) {
      addName(node.name, state);
      next();
    },
  } as Parameters<typeof walk<SvelteAST.SvelteNode, Set<string>>>[2]);

  function addName(name: string, state: Set<string>) {
    if (!state.has(name.split('.')[0])) names.values.add(name);
  }

  // `let:` directives declare names for the element's children, not for its other attributes.
  function visitElement(
    node:
      | SvelteAST.Component
      | SvelteAST.RegularElement
      | SvelteAST.SvelteComponent
      | SvelteAST.SvelteElement,
    state: Set<string>,
    visit: (node: SvelteAST.SvelteNode, state: Set<string>) => void
  ) {
    const declared: string[] = [];
    for (const attribute of node.attributes) {
      if (attribute.type === 'LetDirective') {
        declared.push(
          ...(attribute.expression ? patternNames(attribute.expression) : [attribute.name])
        );
      } else {
        visit(attribute, state);
      }
    }
    if ('expression' in node && node.expression)
      visit(node.expression as SvelteAST.SvelteNode, state);
    visit(node.fragment, declared.length ? new Set([...state, ...declared]) : state);
  }

  return { components, names };
}

function freeNames(code: string, statement: boolean, typescript: boolean) {
  const editor = new SourceEditor(statement ? code : `(${code})`, scriptFile(typescript));
  return { values: [...editor.scopes.unbound], types: typeReferences(editor.program) };
}

function typeReferences(node: Node): string[] {
  const names: string[] = [];
  walkEstree(node, (child) => {
    // `Props` in `let value: Props` and `Base` in `interface Props extends Base`.
    let name: Node | undefined =
      child.type === 'TSTypeReference'
        ? child.typeName
        : child.type === 'TSInterfaceHeritage'
          ? child.expression
          : undefined;
    while (name?.type === 'TSQualifiedName') name = name.left;
    if (name?.type === 'Identifier') names.push(name.name);
  });
  return names;
}

type Declared =
  | {
      kind: 'import';
      start: number;
      statement: E.ImportDeclaration;
      specifier: E.ImportDeclaration['specifiers'][number];
      dependencies: Dependencies;
    }
  | { kind: 'declaration'; start: number; text: string; dependencies: Dependencies };

type Dependencies = { values: string[]; types: string[] };

interface Script {
  declarations: Map<string, Declared>;
  selected: Set<Declared>;
}

// The top-level names a script declares, each with the source that declares it.
function readScript(code: string, typescript: boolean): Script {
  const { program } = new SourceEditor(code, scriptFile(typescript));
  const declarations = new Map<string, Declared>();
  const declare = (names: string[], text: string, start: number) => {
    const declared: Declared = {
      kind: 'declaration',
      start,
      text,
      dependencies: freeNames(text, true, typescript),
    };
    for (const name of names) declarations.set(name, declared);
  };
  for (const item of program.body) {
    if (item.type === 'ImportDeclaration') {
      for (const specifier of item.specifiers) {
        declarations.set(specifier.local.name, {
          kind: 'import',
          start: specifier.start,
          statement: item,
          specifier,
          dependencies: { values: [], types: [] },
        });
      }
      continue;
    }
    const statement =
      item.type === 'ExportNamedDeclaration' && item.declaration ? item.declaration : item;
    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        declare(
          patternNames(declarator.id as never),
          `${statement.kind} ${detachedTextOf(declarator)};`,
          declarator.start
        );
      }
    } else if (
      (statement.type === 'FunctionDeclaration' ||
        statement.type === 'ClassDeclaration' ||
        statement.type === 'TSTypeAliasDeclaration' ||
        statement.type === 'TSInterfaceDeclaration' ||
        statement.type === 'TSEnumDeclaration') &&
      statement.id
    ) {
      declare([statement.id.name], detachedTextOf(statement), statement.start);
    }
  }
  return { declarations, selected: new Set() };
}

// The selected declarations of a script in source order, imports grouped by statement.
function printSelected(script: Script): string[] {
  const selected = [...script.selected].sort((a, b) => a.start - b.start);
  const imports = new Map<E.ImportDeclaration, E.ImportDeclaration['specifiers']>();
  for (const declared of selected) {
    if (declared.kind === 'import') {
      imports.set(declared.statement, [
        ...(imports.get(declared.statement) ?? []),
        declared.specifier,
      ]);
    }
  }
  const importLines = [...imports].map(([statement, specifiers]) => {
    const named = specifiers.filter((specifier) => specifier.type === 'ImportSpecifier');
    const parts = [
      ...specifiers.filter((specifier) => specifier.type !== 'ImportSpecifier').map(textOf),
      ...(named.length ? [`{ ${named.map(textOf).join(', ')} }`] : []),
    ];
    const type = statement.importKind === 'type' ? 'type ' : '';
    return `import ${type}${parts.join(', ')} from ${textOf(statement.source)};`;
  });
  const declarationLines = selected.flatMap((declared) =>
    declared.kind === 'declaration' ? [declared.text] : []
  );
  return [
    ...importLines,
    ...(importLines.length && declarationLines.length ? [''] : []),
    ...declarationLines,
  ];
}
