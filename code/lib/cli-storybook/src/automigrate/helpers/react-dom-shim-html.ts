import { parse, type DefaultTreeAdapterTypes, type ParserError } from 'parse5';

const SHIM = '@storybook/react-dom-shim';
const hasNonStaticHtml = (value: string) => /%[A-Z_][A-Z0-9_]*%|{{|}}|<%|%>|\$\{/.test(value);

const htmlNodes = (node: DefaultTreeAdapterTypes.Node): DefaultTreeAdapterTypes.Node[] => [
  ...('childNodes' in node ? node.childNodes : []),
  ...('content' in node ? htmlNodes(node.content) : []),
];

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

const eventHandler = (name: string) => name.startsWith('on');
const executableUrl = (value: string) =>
  value
    .replaceAll(/[\u0000-\u0020]/g, '')
    .toLowerCase()
    .startsWith('javascript:');

type SourceDiagnostic = (source: string, filePath: string) => string | undefined;

const directShimDiagnostic = (
  element: DefaultTreeAdapterTypes.Element,
  filePath: string,
  sourceDiagnostic: SourceDiagnostic
) => {
  const content = element.tagName === 'script' ? htmlScript(element) : undefined;
  if (
    element.attrs.some(({ value }) => value.includes(SHIM)) ||
    (content !== undefined && content.includes(SHIM))
  ) {
    return `${filePath}: contains a react-dom-shim reference that cannot be removed safely`;
  }
  if (content) {
    const diagnostic = sourceDiagnostic(content, filePath);
    if (diagnostic?.includes('react-dom-shim')) return diagnostic;
  }
  for (const { name, value } of element.attrs) {
    if (!eventHandler(name) && !executableUrl(value)) continue;
    const executable = executableUrl(value) ? value.slice(value.indexOf(':') + 1) : value;
    const diagnostic = sourceDiagnostic(executable, filePath);
    if (diagnostic?.includes('react-dom-shim')) return diagnostic;
  }
  return undefined;
};

const embeddedDocumentDiagnostic = (element: DefaultTreeAdapterTypes.Element, filePath: string) => {
  for (const { name } of element.attrs) {
    if (name === 'srcdoc') {
      return `${filePath}: contains an embedded HTML source document that cannot be scanned safely`;
    }
    if (
      (element.tagName === 'embed' ||
        element.tagName === 'iframe' ||
        element.tagName === 'object') &&
      (name === 'data' || name === 'src')
    ) {
      return `${filePath}: contains an embedded document that cannot be scanned safely`;
    }
  }
  return undefined;
};

const executableAttributeDiagnostic = (
  element: DefaultTreeAdapterTypes.Element,
  filePath: string,
  sourceDiagnostic: SourceDiagnostic
) => {
  for (const { name, value } of element.attrs) {
    if (!eventHandler(name) && !executableUrl(value)) continue;
    const executable = executableUrl(value) ? value.slice(value.indexOf(':') + 1) : value;
    const diagnostic = sourceDiagnostic(executable, filePath);
    if (diagnostic) return diagnostic;
  }
  return undefined;
};

const staticHtmlDiagnostic = (
  element: DefaultTreeAdapterTypes.Element,
  filePath: string,
  sourceDiagnostic: SourceDiagnostic,
  dataDiagnostic: SourceDiagnostic,
  linkedScriptDiagnostic: SourceDiagnostic
) => {
  if (element.tagName === 'base') {
    return `${filePath}: contains an HTML base URL that cannot be scanned safely`;
  }
  const content = element.tagName === 'script' ? htmlScript(element) : undefined;
  if (
    element.attrs.some(
      ({ name, value }) => (name === 'src' || name === 'href') && hasNonStaticHtml(value)
    ) ||
    (content !== undefined && hasNonStaticHtml(content))
  ) {
    return `${filePath}: contains non-static HTML that cannot be scanned safely`;
  }
  const embeddedDiagnostic = embeddedDocumentDiagnostic(element, filePath);
  if (embeddedDiagnostic) return embeddedDiagnostic;
  const attributeDiagnostic = executableAttributeDiagnostic(element, filePath, sourceDiagnostic);
  if (attributeDiagnostic) return attributeDiagnostic;
  if (content === undefined) return undefined;

  const scriptSource = element.attrs.find(({ name }) => name === 'src')?.value;
  if (scriptSource) {
    const diagnostic = linkedScriptDiagnostic(scriptSource, filePath);
    if (diagnostic) return diagnostic;
  }
  const type = element.attrs.find(({ name }) => name === 'type')?.value.toLowerCase();
  if (type === 'importmap' || type === 'importmap-shim') {
    if (!content.trim()) return `${filePath}: cannot parse import map during workspace scan`;
    return dataDiagnostic(content, filePath);
  }
  return content ? sourceDiagnostic(content, filePath) : undefined;
};

export const analyzeReactDomShimHtml = (
  source: string,
  filePath: string,
  sourceDiagnostic: (source: string, filePath: string) => string | undefined,
  dataDiagnostic: (source: string, filePath: string) => string | undefined,
  linkedScriptDiagnostic: (source: string, filePath: string) => string | undefined
): string | undefined => {
  const errors: ParserError[] = [];
  const document = parse(source, { onParseError: (error) => errors.push(error) });
  if (errors.length) return `${filePath}: cannot parse HTML during workspace scan`;

  for (const element of htmlElements(document)) {
    const diagnostic = directShimDiagnostic(element, filePath, sourceDiagnostic);
    if (diagnostic) return diagnostic;
  }

  for (const element of htmlElements(document)) {
    const diagnostic = staticHtmlDiagnostic(
      element,
      filePath,
      sourceDiagnostic,
      dataDiagnostic,
      linkedScriptDiagnostic
    );
    if (diagnostic) return diagnostic;
  }
  return undefined;
};

export const htmlHasShimUse = (
  source: string,
  sourceHasShimUse: (source: string) => boolean
): boolean => {
  const document = parse(source);
  return htmlElements(document).some((element) => {
    const content = element.tagName === 'script' ? htmlScript(element) : '';
    return (
      element.attrs.some(({ value }) => value.includes(SHIM)) ||
      content.includes(SHIM) ||
      sourceHasShimUse(content) ||
      element.attrs
        .filter(({ name, value }) => eventHandler(name) || executableUrl(value))
        .some(({ value }) => sourceHasShimUse(value))
    );
  });
};
