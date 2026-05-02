import { Parser } from 'acorn';
import acornJsx from 'acorn-jsx';
import type { ArrayExpression, Expression, ExpressionStatement, Program } from 'estree';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import type {
  MdxJsxAttribute,
  MdxJsxAttributeValueExpression,
  MdxJsxExpressionAttribute,
  MdxJsxFlowElement,
} from 'mdast-util-mdx-jsx';
import { mdxjs } from 'micromark-extension-mdxjs';

export type AnalyzeResult = {
  title: string | undefined;
  of: string | undefined;
  name: string | undefined;
  summary: string | undefined;
  isTemplate: boolean;
  metaTags?: string[];
  imports: string[];
};

const mdxSyntaxOptions = {
  acorn: Parser.extend(acornJsx()),
  acornOptions: { ecmaVersion: 2024 as const, sourceType: 'module' as const },
  addResult: true,
};

const isMdxJsxAttribute = (
  node: MdxJsxAttribute | MdxJsxExpressionAttribute
): node is MdxJsxAttribute => node.type === 'mdxJsxAttribute';

const parseMdx = (code: string) =>
  fromMarkdown(code, {
    extensions: [mdxjs(mdxSyntaxOptions)],
    mdastExtensions: [mdxFromMarkdown()],
  });

const getAttr = (elt: MdxJsxFlowElement, what: string): MdxJsxAttribute | undefined =>
  elt.attributes.find(
    (node): node is MdxJsxAttribute => isMdxJsxAttribute(node) && node.name === what
  );

const getAttrValue = (
  elt: MdxJsxFlowElement,
  what: string
): MdxJsxAttribute['value'] | undefined => {
  const attr = getAttr(elt, what);
  return attr?.value;
};

const getExpression = (attrValue: MdxJsxAttributeValueExpression): Expression => {
  const expression = attrValue.data?.estree?.body[0];
  if (expression?.type === 'ExpressionStatement') {
    return (expression as ExpressionStatement).expression;
  }

  throw new Error('Expected JSX expression, received unknown');
};

const getAttrLiteral = (elt: MdxJsxFlowElement, what: string): string | undefined => {
  const attrValue = getAttrValue(elt, what);
  if (!attrValue) {
    return undefined;
  }

  if (typeof attrValue === 'string') {
    return attrValue;
  }

  throw new Error(`Expected string literal ${what}, received JSXExpressionContainer`);
};

const getOf = (elt: MdxJsxFlowElement, varToImport: Record<string, string>): string | undefined => {
  const ofAttrValue = getAttrValue(elt, 'of');
  if (!ofAttrValue) {
    return undefined;
  }

  if (typeof ofAttrValue !== 'string') {
    const of = getExpression(ofAttrValue);
    if (of.type === 'Identifier') {
      const importName = varToImport[of.name];
      if (importName) {
        return importName;
      }

      throw new Error(`Unknown identifier ${of.name}`);
    }

    throw new Error(`Expected identifier, received ${of.type}`);
  }

  throw new Error('Expected JSX expression, received Literal');
};

const getTags = (elt: MdxJsxFlowElement): string[] | undefined => {
  const tagsAttr = getAttr(elt, 'tags');
  if (!tagsAttr) {
    return undefined;
  }

  const tagsContainer = tagsAttr.value;
  if (!tagsContainer) {
    throw new Error('Expected JSX expression tags, received null');
  }

  if (typeof tagsContainer !== 'string') {
    const tagsArray = getExpression(tagsContainer);
    if (tagsArray.type === 'ArrayExpression') {
      const metaTags = tagsArray.elements.map((tag: ArrayExpression['elements'][number]) => {
        if (tag.type === 'Literal' && typeof tag.value === 'string') {
          return tag.value;
        }

        throw new Error(`Expected string literal tag, received ${tag.type}`);
      });

      return metaTags;
    }

    throw new Error(`Expected tags array, received ${tagsArray.type}`);
  }

  throw new Error('Expected JSX expression tags, received Literal');
};

const getIsTemplate = (elt: MdxJsxFlowElement): boolean => {
  const isTemplateAttr = getAttr(elt, 'isTemplate');
  if (!isTemplateAttr) {
    return false;
  }

  const isTemplate = isTemplateAttr.value;
  if (isTemplate == null) {
    return true;
  }

  if (typeof isTemplate !== 'string') {
    const expression = getExpression(isTemplate);
    if (expression.type === 'Literal' && typeof expression.value === 'boolean') {
      return expression.value;
    }

    throw new Error(`Expected boolean isTemplate, received ${typeof expression.value}`);
  }

  throw new Error('Expected expression isTemplate, received Literal');
};

const extractMeta = (root: ReturnType<typeof parseMdx>, varToImport: Record<string, string>) => {
  const result = {
    title: undefined,
    of: undefined,
    name: undefined,
    summary: undefined,
    isTemplate: false,
  } as Omit<AnalyzeResult, 'imports'>;

  root.children.forEach((child) => {
    if (child.type === 'mdxJsxFlowElement' && child.name === 'Meta') {
      if (result.title || result.name || result.of) {
        throw new Error('Meta can only be declared once');
      }

      result.title = getAttrLiteral(child, 'title');
      result.name = getAttrLiteral(child, 'name');
      result.summary = getAttrLiteral(child, 'summary');
      result.of = getOf(child, varToImport);
      result.isTemplate = getIsTemplate(child);
      result.metaTags = getTags(child);
    }
  });

  return result;
};

export const extractImports = (root: Program) => {
  const varToImport = {} as Record<string, string>;

  root.body.forEach((child: Program['body'][number]) => {
    if (child.type === 'ImportDeclaration') {
      const { source, specifiers } = child;
      const importPath = source.value;
      if (source.type === 'Literal' && typeof importPath === 'string') {
        specifiers.forEach((specifier) => {
          varToImport[specifier.local.name] = importPath;
        });
      } else {
        throw new Error('MDX: unexpected import source');
      }
    }
  });

  return varToImport;
};

const extractImportsFromMdx = (root: ReturnType<typeof parseMdx>) => {
  const varToImport = {} as Record<string, string>;

  root.children.forEach((child) => {
    if (child.type === 'mdxjsEsm' && child.data?.estree) {
      Object.assign(varToImport, extractImports(child.data.estree as Program));
    }
  });

  return varToImport;
};

export const analyze = async (code: string): Promise<AnalyzeResult> => {
  const root = parseMdx(code);
  const varToImport = extractImportsFromMdx(root);
  const { title, of, name, summary, isTemplate, metaTags } = extractMeta(root, varToImport);
  const imports = Array.from(new Set(Object.values(varToImport)));

  return { title, of, name, summary, isTemplate, metaTags, imports };
};
