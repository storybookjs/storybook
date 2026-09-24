import { parse, type DefaultTreeAdapterTypes, type ParserError } from 'parse5';

const SHIM = '@storybook/react-dom-shim';
const hasNonStaticHtml = (value: string) => /%[A-Z_][A-Z0-9_]*%|{{|}}|<%|%>|\$\{/.test(value);

const htmlNodes = (node: DefaultTreeAdapterTypes.Node): DefaultTreeAdapterTypes.Node[] =>
  'childNodes' in node ? node.childNodes : [];

const htmlElements = (node: DefaultTreeAdapterTypes.Node): DefaultTreeAdapterTypes.Element[] =>
  htmlNodes(node).flatMap((child) => {
    const descendants = htmlElements(child);
    return 'tagName' in child ? [child, ...descendants] : descendants;
  });

const htmlScript = (element: DefaultTreeAdapterTypes.Element) =>
  element.childNodes
    .filter((child): child is DefaultTreeAdapterTypes.TextNode => child.nodeName === '#text')
    .map((child) => child.value)
    .join('');

export const analyzeReactDomShimHtml = (
  source: string,
  filePath: string,
  sourceDiagnostic: (source: string, filePath: string) => string | undefined,
  dataDiagnostic: (source: string, filePath: string) => string | undefined
): string | undefined => {
  const errors: ParserError[] = [];
  const document = parse(source, { onParseError: (error) => errors.push(error) });
  if (errors.length) return `${filePath}: cannot parse HTML during workspace scan`;

  for (const element of htmlElements(document)) {
    const type = element.attrs.find(({ name }) => name === 'type')?.value.toLowerCase();
    const script = element.tagName === 'script';
    const content = script ? htmlScript(element) : undefined;
    if (
      element.attrs.some(({ value }) => value.includes(SHIM)) ||
      (content !== undefined && content.includes(SHIM))
    ) {
      return `${filePath}: contains a react-dom-shim reference that cannot be removed safely`;
    }
    if (
      element.attrs.some(
        ({ name, value }) => (name === 'src' || name === 'href') && hasNonStaticHtml(value)
      ) ||
      (content !== undefined && hasNonStaticHtml(content))
    ) {
      return `${filePath}: contains non-static HTML that cannot be scanned safely`;
    }
    if (!script) continue;
    if (type === 'importmap' || type === 'importmap-shim') {
      if (!content?.trim()) return `${filePath}: cannot parse import map during workspace scan`;
      const diagnostic = dataDiagnostic(content, filePath);
      if (diagnostic) return diagnostic;
    } else if (content) {
      const diagnostic = sourceDiagnostic(content, filePath);
      if (diagnostic) return diagnostic;
    }
  }
  return undefined;
};
