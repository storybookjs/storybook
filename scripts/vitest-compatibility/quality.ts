import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import ts from 'typescript';

const [coverageFile, output = 'vitest-quality.json'] = process.argv.slice(2);
assert(
  coverageFile,
  'Usage: node scripts/vitest-compatibility/quality.ts COVERAGE_JSON OUTPUT_JSON'
);
const coverage: Record<
  string,
  {
    statementMap: Record<string, { start: { line: number }; end: { line: number } }>;
    s: Record<string, number>;
  }
> = JSON.parse(await readFile(coverageFile, 'utf8'));
const targets = [
  ['code/addons/vitest/src/node/vitest-manager.ts', 'startVitest'],
  ['code/addons/vitest/src/node/vitest-manager.ts', 'buildStoryTestNamePattern'],
  ['code/addons/vitest/src/vitest-plugin/index.ts', 'config'],
  ['code/addons/vitest/src/node/coverage-reporter.ts', 'constructor'],
  ['code/addons/vitest/src/node/coverage-reporter.ts', 'onSummary'],
];
const report = [];
for (const [file, name] of targets) {
  const source = ts.createSourceFile(
    file,
    await readFile(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const matches: (ts.MethodDeclaration | ts.ConstructorDeclaration)[] = [];
  function find(node: ts.Node) {
    if (
      (ts.isMethodDeclaration(node) && node.name.getText(source) === name) ||
      (ts.isConstructorDeclaration(node) && name === 'constructor')
    )
      matches.push(node);
    ts.forEachChild(node, find);
  }
  find(source);
  assert.equal(matches.length, 1, `${file}:${name}`);
  const method = matches[0];
  let complexity = 1;
  function count(node: ts.Node) {
    if (node !== method && ts.isFunctionLike(node)) return;
    if (
      ts.isIfStatement(node) ||
      ts.isConditionalExpression(node) ||
      ts.isForStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isCatchClause(node) ||
      ts.isCaseClause(node)
    )
      complexity++;
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
        ts.SyntaxKind.AmpersandAmpersandEqualsToken,
        ts.SyntaxKind.BarBarEqualsToken,
        ts.SyntaxKind.QuestionQuestionEqualsToken,
      ].includes(node.operatorToken.kind)
    )
      complexity++;
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node) ||
        ts.isCallExpression(node)) &&
      node.questionDotToken
    )
      complexity++;
    ts.forEachChild(node, count);
  }
  count(method);
  const start = source.getLineAndCharacterOfPosition(method.getStart()).line + 1;
  const end = source.getLineAndCharacterOfPosition(method.end).line + 1;
  const data = coverage[resolve(file)];
  const statements =
    data &&
    Object.entries(data.statementMap).filter(
      ([, location]) => location.start.line >= start && location.end.line <= end
    );
  const covered = statements?.filter(([id]) => data.s[id] > 0).length;
  const ratio = statements?.length ? covered / statements.length : undefined;
  report.push({
    file,
    name,
    start,
    end,
    complexity,
    coveredStatements: covered,
    totalStatements: statements?.length,
    coverage: ratio,
    crap: ratio === undefined ? null : complexity ** 2 * (1 - ratio) ** 3 + complexity,
    complexityFloorPasses: complexity < 25,
  });
}
await writeFile(
  output,
  JSON.stringify(
    {
      convention:
        'Cyclomatic decisions including short-circuit and optional-chain branches, excluding nested functions; Istanbul statement coverage over the complete method; CRAP = complexity^2 * (1 - coverage)^3 + complexity.',
      report,
    },
    null,
    2
  )
);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
