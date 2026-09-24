import { parseTree, type ParseError, type Node as JsonNode } from 'jsonc-parser';

const SHIM = '@storybook/react-dom-shim';

const hasShimReference = (node: JsonNode): boolean =>
  (typeof node.value === 'string' && node.value.includes(SHIM)) ||
  Boolean(node.children?.some(hasShimReference));

export const analyzeReactDomShimData = (source: string, filePath: string): string | undefined => {
  const errors: ParseError[] = [];
  const tree = parseTree(source, errors);
  if (!tree || errors.length)
    return `${filePath}: cannot parse data configuration during workspace scan`;
  return hasShimReference(tree)
    ? `${filePath}: contains a react-dom-shim reference that cannot be removed safely`
    : undefined;
};
