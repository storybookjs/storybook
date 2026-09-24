import type { DocgenJsDocTags } from '../../services/docgen/types.ts';
import type { StoryDocsPayload } from '../../services/story-docs/types.ts';

const IDENTIFIER = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u;
const TYPE_KEYWORD = /^type(?![$_\u200C\u200D\p{ID_Continue}])/u;
const AS_KEYWORD = /^as(?![$_\u200C\u200D\p{ID_Continue}])/u;
const LEADING_TRIVIA = /^(?:\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*/u;
const TRAILING_TRIVIA = /(?:\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*)*$/u;

type ImportSpecifier =
  | { kind: 'default'; local: string }
  | { kind: 'namespace'; local: string }
  | { kind: 'named'; imported: string; local: string; raw: string };

type ImportDeclaration = {
  source: string;
  quote: string;
  typeOnly: boolean;
  defaultName?: string;
  namespaceName?: string;
  named: string[];
};

function afterContextualType(value: string): string | undefined {
  const trimmed = value.replace(LEADING_TRIVIA, '');
  return TYPE_KEYWORD.test(trimmed) ? trimmed.slice(4).replace(LEADING_TRIVIA, '') : undefined;
}

function maskComments(value: string): string {
  let result = '';
  let quote: string | undefined;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (lineComment) {
      lineComment = character !== '\n';
      result += character === '\n' ? character : ' ';
    } else if (blockComment) {
      if (character === '*' && next === '/') {
        result += '  ';
        index += 1;
        blockComment = false;
      } else {
        result += ' ';
      }
    } else if (quote) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = undefined;
      }
    } else if (character === '/' && next === '/') {
      result += '  ';
      index += 1;
      lineComment = true;
    } else if (character === '/' && next === '*') {
      result += '  ';
      index += 1;
      blockComment = true;
    } else {
      result += character;
      if (character === "'" || character === '"') {
        quote = character;
      }
    }
  }

  return result;
}

function splitImportStatements(imports: string): string[] | undefined {
  const statements: string[] = [];
  const syntax = maskComments(imports);
  let start = 0;
  let quote: string | undefined;
  let escaped = false;
  let braceDepth = 0;

  for (let index = 0; index < syntax.length; index += 1) {
    const character = syntax[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = undefined;
      }
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === '{') {
      braceDepth += 1;
    } else if (character === '}') {
      braceDepth -= 1;
    } else if (
      braceDepth === 0 &&
      (character === ';' ||
        (character === '\n' &&
          imports.slice(start, index).trim().length > 0 &&
          syntax
            .slice(index + 1)
            .trimStart()
            .startsWith('import ')))
    ) {
      statements.push(imports.slice(start, index + 1).trim());
      start = index + 1;
    }
  }

  const remainder = imports.slice(start).trim();
  if (remainder) {
    statements.push(remainder);
  }
  return quote ||
    braceDepth !== 0 ||
    statements.some((statement) => !statement.startsWith('import '))
    ? undefined
    : statements;
}

function parseImport(statement: string): ImportDeclaration | undefined {
  const sideEffect = statement.match(
    /^import\s+(['"])([^'"]+)\1(?:\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*;?(?:\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*$/
  );
  if (sideEffect) {
    return { source: sideEffect[2], quote: sideEffect[1], typeOnly: false, named: [] };
  }
  const match = statement.match(
    /^import\s+([\s\S]+?)(?:\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)+from\s+(['"])([^'"]+)\2(?:\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*;?(?:\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*(?:\n|$))*$/
  );
  if (!match) {
    return undefined;
  }

  const [, clause, quote, source] = match;
  const syntax = maskComments(clause);
  const namedStart = syntax.indexOf('{');
  const namedEnd = syntax.lastIndexOf('}');
  const namespaceMatch = syntax.match(/\*\s*as\s+([^\s,{}]+)/);
  const specialIndexes = [namedStart, syntax.indexOf('*')].filter((index) => index >= 0);
  const prefix = syntax.slice(0, Math.min(...specialIndexes, syntax.length));
  const typeRemainder = afterContextualType(clause);
  const contextualTypeDefault =
    typeRemainder !== undefined && (typeRemainder === '' || typeRemainder.startsWith(','));
  const defaultName = contextualTypeDefault ? 'type' : prefix.trim().replace(/,$/, '').trim();
  const namespaceName = namespaceMatch?.[1];
  if (
    (defaultName && !IDENTIFIER.test(defaultName)) ||
    (namespaceName && !IDENTIFIER.test(namespaceName))
  ) {
    return undefined;
  }

  return {
    source,
    quote,
    typeOnly: typeRemainder !== undefined && !contextualTypeDefault,
    ...(defaultName ? { defaultName } : {}),
    ...(namespaceName ? { namespaceName } : {}),
    named:
      namedStart >= 0 && namedEnd > namedStart
        ? splitNamedSpecifiers(clause.slice(namedStart + 1, namedEnd))
        : [],
  };
}

function splitNamedSpecifiers(value: string): string[] {
  const syntax = maskComments(value);
  const specifiers: string[] = [];
  let start = 0;

  for (let index = 0; index < syntax.length; index += 1) {
    if (syntax[index] === ',') {
      specifiers.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  specifiers.push(value.slice(start).trim());
  return specifiers.filter(Boolean);
}

function parseNamedSpecifier(raw: string): ImportSpecifier | undefined {
  const syntax = maskComments(raw).trim();
  const typeRemainder = afterContextualType(syntax);
  if (typeRemainder !== undefined) {
    if (typeRemainder === '') {
      return { kind: 'named', imported: 'type', local: 'type', raw };
    }
    if (AS_KEYWORD.test(typeRemainder)) {
      const local = typeRemainder.slice(2).replace(LEADING_TRIVIA, '').replace(TRAILING_TRIVIA, '');
      return IDENTIFIER.test(local) ? { kind: 'named', imported: 'type', local, raw } : undefined;
    }
    return undefined;
  }

  const parts = syntax.split(/\s+as\s+/);
  const [imported, local = imported] = parts;
  return parts.length <= 2 && IDENTIFIER.test(imported) && IDENTIFIER.test(local)
    ? { kind: 'named', imported, local, raw }
    : undefined;
}

function specifiers(declaration: ImportDeclaration): ImportSpecifier[] {
  if (declaration.typeOnly) {
    return [];
  }

  const result: ImportSpecifier[] = [];
  if (declaration.defaultName) {
    result.push({ kind: 'default', local: declaration.defaultName });
  }
  if (declaration.namespaceName) {
    result.push({ kind: 'namespace', local: declaration.namespaceName });
  }
  for (const raw of declaration.named) {
    const specifier = parseNamedSpecifier(raw);
    if (specifier) {
      result.push(specifier);
    }
  }
  return result;
}

function renderImport(declaration: ImportDeclaration): string | undefined {
  const tail = declaration.namespaceName
    ? `* as ${declaration.namespaceName}`
    : declaration.named.length > 0
      ? `{ ${declaration.named.join(', ')} }`
      : undefined;
  const clause = [declaration.defaultName, tail].filter(Boolean).join(', ');
  return clause
    ? `import ${clause} from ${declaration.quote}${declaration.source}${declaration.quote};`
    : undefined;
}

function renderOverride(
  declaration: ImportDeclaration,
  specifier: ImportSpecifier,
  local: string
): string {
  const clause =
    specifier.kind === 'default'
      ? local
      : specifier.kind === 'namespace'
        ? `* as ${specifier.local}`
        : `{ ${specifier.imported}${specifier.imported === local ? '' : ` as ${local}`} }`;
  return `import ${clause} from ${declaration.quote}${declaration.source}${declaration.quote};`;
}

function applyImportOverride(
  imports: string,
  componentName: string,
  importOverride: string
): string {
  const statements = splitImportStatements(imports);
  const overrideStatements = splitImportStatements(importOverride);
  const override =
    overrideStatements?.length === 1 ? parseImport(overrideStatements[0]) : undefined;
  const overrideSpecifier = override ? specifiers(override)[0] : undefined;
  if (!statements || !override || !overrideSpecifier) {
    return imports;
  }

  const declarations = statements.map(parseImport);
  const candidates = declarations.flatMap((declaration, statementIndex) =>
    declaration
      ? specifiers(declaration).map((specifier) => ({ declaration, specifier, statementIndex }))
      : []
  );
  const dot = componentName.indexOf('.');
  const baseName = dot === -1 ? componentName : componentName.slice(0, dot);
  const memberName = dot === -1 ? undefined : componentName.slice(dot + 1);
  const match =
    candidates.find(({ specifier }) => specifier.local === baseName) ??
    (memberName ? candidates.find(({ specifier }) => specifier.local === memberName) : undefined);
  if (!match) {
    return imports;
  }

  const local = match.specifier.local === memberName ? baseName : match.specifier.local;
  const overrideStatement = renderOverride(override, overrideSpecifier, local);
  const remaining = { ...match.declaration };
  if (match.specifier.kind === 'default') {
    delete remaining.defaultName;
  } else if (match.specifier.kind === 'namespace') {
    delete remaining.namespaceName;
  } else {
    const { raw } = match.specifier;
    remaining.named = remaining.named.filter((named) => named !== raw);
  }

  return statements
    .flatMap((statement, index) =>
      index === match.statementIndex
        ? [overrideStatement, renderImport(remaining)].filter((value): value is string => !!value)
        : statement
    )
    .join('\n');
}

export function composeComponentImport(
  jsDocTags: DocgenJsDocTags | undefined,
  storyDocs: Partial<Pick<StoryDocsPayload, 'name' | 'import'>> | null | undefined
): string | undefined {
  const imports = storyDocs?.import;
  const importOverride = jsDocTags?.import?.[0]?.trim();
  if (!imports || !importOverride || !storyDocs?.name) {
    return imports;
  }

  return applyImportOverride(imports, storyDocs.name, importOverride);
}
