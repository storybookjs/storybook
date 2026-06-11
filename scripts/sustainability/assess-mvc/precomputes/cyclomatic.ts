import ts from 'typescript';

export interface FunctionComplexity {
  name: string;
  complexity: number;
}

const SCRIPT_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

export function complexityForSource(filename: string, source: string): FunctionComplexity[] {
  if (!SCRIPT_EXTS.some((ext) => filename.endsWith(ext))) return [];
  const sf = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.Latest
  );
  const results: FunctionComplexity[] = [];

  const findEnclosingClassName = (node: ts.Node): string | undefined => {
    let cur: ts.Node | undefined = node.parent;
    while (cur) {
      if (ts.isClassDeclaration(cur) || ts.isClassExpression(cur)) return cur.name?.text ?? 'Anon';
      cur = cur.parent;
    }
    return undefined;
  };

  const nameOfFunctionLike = (node: ts.Node): string | undefined => {
    if (ts.isFunctionDeclaration(node)) return node.name?.text;
    if (ts.isMethodDeclaration(node)) {
      const cls = findEnclosingClassName(node);
      const m =
        node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
          ? node.name.text
          : 'method';
      return cls ? `${cls}.${m}` : m;
    }
    if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      const parent = node.parent;
      if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
      if (
        parent &&
        ts.isPropertyAssignment(parent) &&
        (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))
      ) {
        return parent.name.text;
      }
      return undefined;
    }
    return undefined;
  };

  const visitFunction = (node: ts.Node, name: string) => {
    let complexity = 1;
    const walk = (n: ts.Node) => {
      switch (n.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.CatchClause:
          complexity += 1;
          break;
        case ts.SyntaxKind.BinaryExpression: {
          const op = (n as ts.BinaryExpression).operatorToken.kind;
          if (
            op === ts.SyntaxKind.AmpersandAmpersandToken ||
            op === ts.SyntaxKind.BarBarToken ||
            op === ts.SyntaxKind.QuestionQuestionToken
          ) {
            complexity += 1;
          }
          break;
        }
        default:
          break;
      }
      if (
        n !== node &&
        (ts.isFunctionDeclaration(n) ||
          ts.isFunctionExpression(n) ||
          ts.isArrowFunction(n) ||
          ts.isMethodDeclaration(n))
      ) {
        return;
      }
      ts.forEachChild(n, walk);
    };
    walk(node);
    results.push({ name, complexity });
  };

  const visit = (node: ts.Node) => {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      const name = nameOfFunctionLike(node) ?? '<anonymous>';
      visitFunction(node, name);
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return results;
}

export async function complexityForChangedFiles(
  fetchContents: (path: string, sha: string) => Promise<string | null>,
  files: Array<{ path: string; status: string }>,
  headSha: string
): Promise<Array<{ path: string; functions: FunctionComplexity[] }>> {
  const out: Array<{ path: string; functions: FunctionComplexity[] }> = [];
  for (const f of files) {
    if (f.status === 'removed') continue;
    if (!SCRIPT_EXTS.some((ext) => f.path.endsWith(ext))) continue;
    const src = await fetchContents(f.path, headSha);
    if (src == null) continue;
    out.push({ path: f.path, functions: complexityForSource(f.path, src) });
  }
  return out;
}
