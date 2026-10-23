import { parseModule, walk } from 'storybook/internal/csf-tools';

import { dirname, join } from 'pathe';
import { parse, type DefaultTreeAdapterMap } from 'parse5';

export function resolveTurbosnapOutputReference(
  value: string,
  owner: string,
  references: ReadonlyMap<string, string>
) {
  if (/^(?:[a-z]+:|\/\/)/i.test(value)) return undefined;
  const suffixAt = value.search(/[?#]/);
  const path = decodeURIComponent(suffixAt === -1 ? value : value.slice(0, suffixAt));
  const suffix = suffixAt === -1 ? '' : value.slice(suffixAt);
  const relative = path.startsWith('/') ? path.slice(1) : join(dirname(owner), path);
  const file = references.has(relative) ? relative : undefined;
  return file ? { file, value: `${references.get(file)}${suffix}` } : undefined;
}

export function canonicalizeTurbosnapHtml(
  source: string,
  fileName: string,
  references: ReadonlyMap<string, string>
): { code: string; dependencies: string[] } {
  const changes: { start: number; end: number; value: string }[] = [];
  const dependencies = new Set<string>();
  function visit(node: DefaultTreeAdapterMap['node']) {
    if (
      'tagName' in node &&
      node.tagName === 'base' &&
      node.attrs.some((item) => item.name === 'href')
    )
      throw new Error('unsupported-html-base');
    if ('tagName' in node && (node.tagName === 'script' || node.tagName === 'link')) {
      const name = node.tagName === 'script' ? 'src' : 'href';
      const attribute = node.attrs.find((item) => item.name === name);
      const span = node.sourceCodeLocation?.attrs?.[name];
      const target =
        attribute && resolveTurbosnapOutputReference(attribute.value, fileName, references);
      if (
        attribute &&
        !target &&
        !/^(?:[a-z]+:|\/\/)/i.test(attribute.value) &&
        (node.tagName === 'script' ||
          node.attrs.some((item) => item.name === 'rel' && item.value === 'modulepreload'))
      )
        throw new Error('unresolved-html-output-reference');
      if (attribute && span && target) {
        const identity = target.value;
        if (identity) {
          changes.push({
            start: span.startOffset,
            end: span.endOffset,
            value: `${name}=${JSON.stringify(identity)}`,
          });
          dependencies.add(target.file);
        }
      }
    }
    if (
      'tagName' in node &&
      node.tagName === 'script' &&
      !node.attrs.some((item) => item.name === 'src')
    ) {
      const type = node.attrs.find((item) => item.name === 'type')?.value;
      if (type === 'importmap') throw new Error('unsupported-html-importmap');
      if (!type || ['module', 'text/javascript', 'application/javascript'].includes(type)) {
        const offset = node.sourceCodeLocation?.startTag?.endOffset;
        const end = node.sourceCodeLocation?.endTag?.startOffset;
        if (offset === undefined || end === undefined)
          throw new Error('missing-inline-script-location');
        const inline = source.slice(offset, end);
        const { code: parsedCode, program } = parseModule(inline, `${fileName}.js`);
        if (parsedCode !== inline) throw new Error('normalized-inline-source');
        walk(program, (child) => {
          const source =
            child.type === 'ImportExpression'
              ? child.source
              : child.type === 'ImportDeclaration' ||
                  child.type === 'ExportAllDeclaration' ||
                  child.type === 'ExportNamedDeclaration'
                ? child.source
                : undefined;
          if (!source) return;
          if (source.type !== 'Literal' || typeof source.value !== 'string')
            throw new Error('dynamic-inline-output-reference');
          if (!/^(?:\.{1,2}\/|\/|[a-z]+:)/i.test(source.value))
            throw new Error('unresolved-inline-output-reference');
          const target = resolveTurbosnapOutputReference(source.value, fileName, references);
          if (!target && !/^(?:[a-z]+:|\/\/)/i.test(source.value))
            throw new Error('unresolved-inline-output-reference');
          if (target) {
            dependencies.add(target.file);
            changes.push({
              start: offset + source.start,
              end: offset + source.end,
              value: JSON.stringify(target.value),
            });
          }
        });
      }
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
    if ('content' in node) visit(node.content);
  }
  visit(parse(source, { sourceCodeLocationInfo: true }));
  const code = changes
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, { start, end, value }) => result.slice(0, start) + value + result.slice(end),
      source
    );
  return { code, dependencies: [...dependencies] };
}
