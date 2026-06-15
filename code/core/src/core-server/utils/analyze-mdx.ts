import { Parser } from 'acorn';
import acornJsx from 'acorn-jsx';
import type { Expression, Program, SpreadElement } from 'estree';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import type {
  MdxJsxAttribute,
  MdxJsxAttributeValueExpression,
  MdxJsxExpressionAttribute,
  MdxJsxFlowElement,
} from 'mdast-util-mdx-jsx';
import { mdxjs } from 'micromark-extension-mdxjs';

export type MdxAnalysisResult = {
  title: string | undefined;
  of: string | undefined;
  name: string | undefined;
  id: string | undefined;
  summary: string | undefined;
  isTemplate: boolean;
  metaTags?: string[];
  imports: string[];
  headings: string[];
};

type ImportMap = Record<string, string>;
type ArrayElement = Expression | SpreadElement | null;

const mdxSyntaxOptions = {
  acorn: Parser.extend(acornJsx()),
  acornOptions: { ecmaVersion: 2024 as const, sourceType: 'module' as const },
  addResult: true,
};

const parseMdx = (code: string) =>
  fromMarkdown(code, {
    extensions: [mdxjs(mdxSyntaxOptions)],
    mdastExtensions: [mdxFromMarkdown()],
  });

type ParsedMdxRoot = ReturnType<typeof parseMdx>;
type MdxMetadata = Omit<MdxAnalysisResult, 'imports' | 'headings'>;

const createEmptyMdxMetadata = (): MdxMetadata => ({
  title: undefined,
  of: undefined,
  name: undefined,
  id: undefined,
  summary: undefined,
  isTemplate: false,
  metaTags: undefined,
});

const isMdxJsxAttribute = (
  node: MdxJsxAttribute | MdxJsxExpressionAttribute
): node is MdxJsxAttribute => node.type === 'mdxJsxAttribute';

const isMetaElement = (node: ParsedMdxRoot['children'][number]): node is MdxJsxFlowElement =>
  node.type === 'mdxJsxFlowElement' && node.name === 'Meta';

const isStringLiteral = (
  value: ArrayElement
): value is Expression & { type: 'Literal'; value: string } =>
  value?.type === 'Literal' && typeof value.value === 'string';

const getAttribute = (
  metaElement: MdxJsxFlowElement,
  attributeName: string
): MdxJsxAttribute | undefined =>
  metaElement.attributes.find(
    (node): node is MdxJsxAttribute => isMdxJsxAttribute(node) && node.name === attributeName
  );

const getAttributeValue = (
  metaElement: MdxJsxFlowElement,
  attributeName: string
): MdxJsxAttribute['value'] | undefined => getAttribute(metaElement, attributeName)?.value;

const getExpression = (attributeValue: MdxJsxAttributeValueExpression): Expression => {
  const expressionStatement = attributeValue.data?.estree?.body[0];
  if (expressionStatement?.type === 'ExpressionStatement') {
    return expressionStatement.expression;
  }

  throw new Error('Expected JSX expression, received unknown');
};

const getStringAttribute = (
  metaElement: MdxJsxFlowElement,
  attributeName: string
): string | undefined => {
  const attributeValue = getAttributeValue(metaElement, attributeName);
  if (!attributeValue) {
    return undefined;
  }

  if (typeof attributeValue === 'string') {
    return attributeValue;
  }

  throw new Error(`Expected string literal ${attributeName}, received JSXExpressionContainer`);
};

const getOfImportPath = (
  metaElement: MdxJsxFlowElement,
  importMap: ImportMap
): string | undefined => {
  const attributeValue = getAttributeValue(metaElement, 'of');
  if (!attributeValue) {
    return undefined;
  }

  if (typeof attributeValue === 'string') {
    throw new Error('Expected JSX expression, received Literal');
  }

  const expression = getExpression(attributeValue);
  if (expression.type !== 'Identifier') {
    throw new Error(`Expected identifier, received ${expression.type}`);
  }

  const importPath = importMap[expression.name];
  if (importPath) {
    return importPath;
  }

  throw new Error(`Unknown identifier ${expression.name}`);
};

const getMetaTags = (metaElement: MdxJsxFlowElement): string[] | undefined => {
  const attribute = getAttribute(metaElement, 'tags');
  if (!attribute) {
    return undefined;
  }

  const attributeValue = attribute.value;
  if (!attributeValue) {
    throw new Error('Expected JSX expression tags, received null');
  }

  if (typeof attributeValue === 'string') {
    throw new Error('Expected JSX expression tags, received Literal');
  }

  const expression = getExpression(attributeValue);
  if (expression.type !== 'ArrayExpression') {
    throw new Error(`Expected tags array, received ${expression.type}`);
  }

  return expression.elements.map((element) => {
    if (isStringLiteral(element)) {
      return element.value;
    }

    throw new Error(`Expected string literal tag, received ${element?.type ?? 'null'}`);
  });
};

const getIsTemplate = (metaElement: MdxJsxFlowElement): boolean => {
  const attribute = getAttribute(metaElement, 'isTemplate');
  if (!attribute) {
    return false;
  }

  const attributeValue = attribute.value;
  if (attributeValue == null) {
    return true;
  }

  if (typeof attributeValue === 'string') {
    throw new Error('Expected expression isTemplate, received Literal');
  }

  const expression = getExpression(attributeValue);
  if (expression.type === 'Literal' && typeof expression.value === 'boolean') {
    return expression.value;
  }

  throw new Error(
    `Expected boolean isTemplate, received ${typeof (expression as { value?: unknown }).value}`
  );
};

const extractMeta = (metaElement: MdxJsxFlowElement, importMap: ImportMap): MdxMetadata => ({
  title: getStringAttribute(metaElement, 'title'),
  of: getOfImportPath(metaElement, importMap),
  name: getStringAttribute(metaElement, 'name'),
  id: getStringAttribute(metaElement, 'id'),
  summary: getStringAttribute(metaElement, 'summary'),
  isTemplate: getIsTemplate(metaElement),
  metaTags: getMetaTags(metaElement),
});

const getHeadingText = (node: { children?: unknown[] }): string => {
  if (!node.children) {
    return '';
  }
  return node.children
    .map((child) => {
      const c = child as { type: string; value?: string; children?: unknown[] };
      if (c.type === 'text') {
        return c.value ?? '';
      }
      if (c.children) {
        return getHeadingText(c as { children: unknown[] });
      }
      return '';
    })
    .join('');
};

const getHeadings = (root: ParsedMdxRoot): string[] => {
  const headings: string[] = [];

  const walk = (nodes: unknown[]) => {
    for (const node of nodes) {
      const n = node as { type: string; depth?: number; children?: unknown[] };
      if (n.type === 'heading' && typeof n.depth === 'number' && n.depth <= 4) {
        headings.push(getHeadingText(n as { children?: unknown[] }));
      }
      if (n.children) {
        walk(n.children);
      }
    }
  };

  walk(root.children as unknown[]);
  return headings;
};

export const extractImports = (root: Program): ImportMap => {
  const importMap: ImportMap = {};

  for (const child of root.body) {
    if (child.type !== 'ImportDeclaration') {
      continue;
    }

    const importPath = child.source.value;
    if (child.source.type !== 'Literal' || typeof importPath !== 'string') {
      throw new Error('MDX: unexpected import source');
    }

    for (const specifier of child.specifiers) {
      importMap[specifier.local.name] = importPath;
    }
  }

  return importMap;
};

const analyzeParsedMdx = (root: ParsedMdxRoot): MdxAnalysisResult => {
  const importMap: ImportMap = {};
  let metaElement: MdxJsxFlowElement | undefined;

  for (const child of root.children) {
    if (child.type === 'mdxjsEsm' && child.data?.estree) {
      Object.assign(importMap, extractImports(child.data.estree as Program));
    }

    if (isMetaElement(child)) {
      if (metaElement) {
        throw new Error('Meta can only be declared once');
      }

      metaElement = child;
    }
  }

  const metadata = metaElement ? extractMeta(metaElement, importMap) : createEmptyMdxMetadata();

  return {
    ...metadata,
    imports: Array.from(new Set(Object.values(importMap))),
    headings: getHeadings(root),
  };
};

export const analyzeMdx = async (code: string): Promise<MdxAnalysisResult> =>
  analyzeParsedMdx(parseMdx(code));
