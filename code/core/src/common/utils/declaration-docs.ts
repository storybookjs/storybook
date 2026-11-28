import { extractDocblocks } from '../../csf-tools/enrichCsf.ts';
import { type Node, restoreLineEndings } from '../../csf-tools/estree/ast.ts';
import { type JsDocTagMap, extractDeclarationJSDocInfo } from '../../csf-tools/jsdoc.ts';
import { parseReferenceModule } from '../../csf-tools/story-shape/reference-context.ts';
import type { ReferenceModule } from '../../csf-tools/story-shape/resolve-members.ts';
import { type ExportReader, declares, moduleExportName } from './follow-export.ts';
import { createModuleResolver, defaultResolveConditionNames } from './module-resolver.ts';

/** What the source of a module says about a component it declares. */
export interface DeclarationDocs {
  /** The name it declares, such as a class name. `undefined` for an anonymous default export. */
  name: string | undefined;
  /** The text of its docblock up to the first tag. */
  description: string;
  /** The tags of its docblock, with a value for each time a tag is written. */
  tags: JsDocTagMap;
}

/**
 * Resolves an import to the file TypeScript documents it from: the source, or the declaration file
 * of a package or of a JS build that has one. A package's build can lose the docblocks that its
 * declaration file keeps.
 */
export const createDocsModuleResolver = () =>
  createModuleResolver({
    extensions: ['.ts', '.tsx', '.d.ts', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
    extensionAlias: {
      '.js': ['.ts', '.tsx', '.d.ts', '.js'],
      '.jsx': ['.tsx', '.jsx'],
      '.mjs': ['.mts', '.d.mts', '.mjs'],
      '.cjs': ['.cts', '.d.cts', '.cjs'],
    },
    mainFields: ['types', 'typings', 'module', 'main'],
    conditionNames: ['types', ...defaultResolveConditionNames],
    tsconfig: 'auto',
  });

const TYPE_DECLARATIONS = new Set([
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSModuleDeclaration',
]);

const declarationOf = (statement: Node): Node =>
  'declaration' in statement && statement.declaration ? statement.declaration : statement;

// The top-level statements that declare what `module` exports as `exportName`, or binds under that
// name when it exports nothing by it, with the name they declare. The first that is not a type is
// the component. An import is none of them: the docblock above it belongs to the importing module.
function findDeclaration(module: ReferenceModule, exportName: string) {
  const { body } = module.editor.program;
  let localName = exportName;
  for (const statement of body) {
    if (statement.type === 'ExportDefaultDeclaration' && exportName === 'default') {
      const { declaration } = statement;
      if (declaration.type !== 'Identifier') {
        const name = 'id' in declaration ? declaration.id?.name : undefined;
        return { statement, name, statements: [statement] };
      }
      localName = declaration.name;
    } else if (statement.type === 'ExportNamedDeclaration' && !statement.source) {
      const specifier = statement.specifiers.find(
        (candidate) => moduleExportName(candidate.exported) === exportName
      );
      if (specifier) {
        localName = moduleExportName(specifier.local);
      }
    }
  }
  const statements = body.filter((candidate) =>
    declares(module, declarationOf(candidate), localName)
  );
  const statement = statements.find(
    (candidate) => !TYPE_DECLARATIONS.has(declarationOf(candidate).type)
  );
  return statement && { statement, name: localName, statements };
}

// The docblock that documents the declaration in a statement, as TypeScript picks it: the last one
// above the statement, or above the decorators of the class it declares, with the line endings of
// the file.
function readDocblock(statement: Node, { editor }: ReferenceModule): string | undefined {
  const declaration = declarationOf(statement);
  const decorators = 'decorators' in declaration ? (declaration.decorators ?? []) : [];
  const start = Math.min(statement.start, ...decorators.map((decorator) => decorator.start));
  const docblock = extractDocblocks({ ...statement, start }, editor).at(-1);
  return docblock && restoreLineEndings(docblock, editor.toString());
}

/**
 * Reads the docs of the component that the module at `path` declares and exports as `exportName`,
 * from the docblock above its declaration. A component whose name also declares overloads or a
 * type has the docblocks of those too, as TypeScript reports them for the name.
 *
 * This is where docgen gets the description and tags of a component, so it needs no type checker
 * for them. `path` and `exportName` are what a component resolver followed the story file's import
 * to, as `createMetaComponentResolver` does. `undefined` when the module cannot be read or does
 * not declare the export itself.
 */
export function readDeclarationDocs(
  { path, exportName }: { path?: string; exportName: string },
  readModule: NonNullable<ExportReader['readModule']> = parseReferenceModule
): DeclarationDocs | undefined {
  const module = path ? readModule(path) : undefined;
  const found = module && findDeclaration(module, exportName);
  if (!module || !found) {
    return undefined;
  }
  const docblocks = found.statements.flatMap((statement) => readDocblock(statement, module) ?? []);
  return { name: found.name, ...extractDeclarationJSDocInfo(docblocks) };
}
