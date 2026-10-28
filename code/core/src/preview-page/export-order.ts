import { init as initCjsLexer, parse as parseCjs } from 'cjs-module-lexer';
import { init as initEsLexer, parse as parseEs } from 'es-module-lexer';
import MagicString, { type SourceMap } from 'magic-string';

/** Match story and MDX files whose export order the preview reads. */
export const EXPORT_ORDER_FILE_PATTERN = /\.stories\.([tj])sx?$|(stories|story)\.mdx$/;

/**
 * Append `__namedExportsOrder` to a story module so the preview keeps the source order of its
 * stories. Return `undefined` when the module already declares it or exports nothing named.
 */
export async function appendNamedExportsOrder(
  code: string,
  id?: string
): Promise<{ code: string; map: SourceMap } | undefined> {
  const appended = await getExportsOrderStatement(code);
  if (!appended) {
    return undefined;
  }
  const source = new MagicString(code);
  source.append(appended);
  return { code: source.toString(), map: source.generateMap({ hires: true, source: id }) };
}

async function getExportsOrderStatement(code: string): Promise<string | undefined> {
  await initEsLexer;
  let esm: { names: string[]; hasModuleSyntax: boolean } | undefined;
  try {
    const [, exports, , hasModuleSyntax] = parseEs(code);
    esm = { names: exports.map((entry) => entry.n), hasModuleSyntax };
  } catch {}
  if (esm?.hasModuleSyntax) {
    return esm.names.includes('__namedExportsOrder')
      ? undefined
      : `;export const __namedExportsOrder = ${JSON.stringify(esm.names.filter((name) => name !== 'default'))};`;
  }
  await initCjsLexer();
  let names: string[];
  try {
    names = parseCjs(code).exports;
  } catch {
    return undefined;
  }
  const named = names.filter((name) => name !== 'default' && name !== '__esModule');
  return named.length === 0 || names.includes('__namedExportsOrder')
    ? undefined
    : `;module.exports.__namedExportsOrder = ${JSON.stringify(named)};`;
}
