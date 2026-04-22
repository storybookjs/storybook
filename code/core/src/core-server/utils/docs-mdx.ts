import { toEstree } from 'hast-util-to-estree';
import type { Program, ExpressionStatement } from 'hast-util-to-estree/lib';
import type {
  JSXFragment,
  JSXAttribute,
  JSXSimpleAttribute,
  JSXElement,
  JSXOpeningElement,
} from 'estree-jsx';

export type AnalyzeResult = {
  title: string | undefined;
  of: string | undefined;
  name: string | undefined;
  summary: string | undefined;
  isTemplate: boolean;
  metaTags: string[] | undefined;
  imports: string[];
};

const getAttr = (elt: JSXOpeningElement, what: string): JSXAttribute | undefined =>
  elt.attributes.find((node) => node.type === 'JSXAttribute' && node.name.name === what);

const getAttrValue = (
  elt: JSXOpeningElement,
  what: string
): JSXSimpleAttribute['value'] | undefined => {
  const attr = getAttr(elt, what);
  return (attr as any)?.value;
};

const getAttrLiteral = (elt: JSXOpeningElement, what: string): any | undefined => {
  const attrValue = getAttrValue(elt, what);
  if (!attrValue) {
    return undefined;
  }

  if (attrValue.type === 'Literal') {
    return (attrValue as any).value;
  }

  throw new Error(`Expected string literal ${what}, received ${attrValue.type}`);
};

const getOf = (elt: JSXOpeningElement, varToImport: Record<string, string>): string | undefined => {
  const ofAttrValue = getAttrValue(elt, 'of');
  if (!ofAttrValue) {
    return undefined;
  }

  if (ofAttrValue.type === 'JSXExpressionContainer') {
    const of = (ofAttrValue as any).expression;
    if (of?.type === 'Identifier') {
      const importName = varToImport[of.name];
      if (importName) {
        return importName;
      }

      throw new Error(`Unknown identifier ${of.name}`);
    }

    throw new Error(`Expected identifier, received ${of.type}`);
  }

  throw new Error(`Expected JSX expression, received ${ofAttrValue.type}`);
};

const getTags = (elt: JSXOpeningElement): string[] | undefined => {
  const tagsAttr = getAttr(elt, 'tags');
  if (!tagsAttr) {
    return undefined;
  }

  const tagsContainer = (tagsAttr as JSXSimpleAttribute).value;
  if (tagsContainer.type === 'JSXExpressionContainer') {
    const tagsArray = (tagsContainer as any).expression;
    if (tagsArray.type === 'ArrayExpression') {
      const metaTags = (tagsArray as any).elements.map((tag: any) => {
        if (tag.type === 'Literal' && typeof tag.value === 'string') {
          return tag.value;
        }

        throw new Error(`Expected string literal tag, received ${tag.type}`);
      });

      return metaTags;
    }

    throw new Error(`Expected tags array, received ${tagsArray.type}`);
  }

  throw new Error(`Expected JSX expression tags, received ${tagsContainer.type}`);
};

const getIsTemplate = (elt: JSXOpeningElement): boolean => {
  const isTemplateAttr = getAttr(elt, 'isTemplate') as JSXSimpleAttribute | undefined;
  if (!isTemplateAttr) {
    return false;
  }

  const isTemplate = (isTemplateAttr as any).value;
  if (isTemplate == null) {
    return true;
  }

  if (isTemplate.type === 'JSXExpressionContainer') {
    const expression = isTemplate.expression;
    if (expression.type === 'Literal' && typeof expression.value === 'boolean') {
      return expression.value;
    }

    throw new Error(`Expected boolean isTemplate, received ${typeof expression.value}`);
  }

  throw new Error(`Expected expression isTemplate, received ${isTemplate.type}`);
};

const extractTitle = (root: Program, varToImport: Record<string, string>) => {
  const result = {
    title: undefined,
    of: undefined,
    name: undefined,
    summary: undefined,
    isTemplate: false,
  } as Omit<AnalyzeResult, 'imports'>;

  const fragments = root.body.filter(
    (child) =>
      child.type === 'ExpressionStatement' && (child.expression as any).type === 'JSXFragment'
  ) as ExpressionStatement[];

  if (fragments.length > 1) {
    throw new Error('duplicate contents');
  }

  if (fragments.length === 0) {
    return result;
  }

  const fragment = fragments[0].expression as any as JSXFragment;
  fragment.children.forEach((child) => {
    if (child.type === 'JSXElement') {
      const { openingElement } = child as JSXElement;
      const name = openingElement.name.name;

      if (name === 'Meta') {
        if (result.title || result.name || result.of) {
          throw new Error('Meta can only be declared once');
        }

        result.title = getAttrLiteral(openingElement, 'title');
        result.name = getAttrLiteral(openingElement, 'name');
        result.summary = getAttrLiteral(openingElement, 'summary');
        result.of = getOf(openingElement, varToImport);
        result.isTemplate = getIsTemplate(openingElement);
        result.metaTags = getTags(openingElement);
      }
    } else if (child.type !== 'JSXExpressionContainer') {
      throw new Error(`Unexpected JSX child: ${child.type}`);
    }
  });

  return result;
};

export const extractImports = (root: Program) => {
  const varToImport = {} as Record<string, string>;

  root.body.forEach((child) => {
    if (child.type === 'ImportDeclaration') {
      const { source, specifiers } = child;
      if (source.type === 'Literal') {
        specifiers.forEach((specifier) => {
          varToImport[specifier.local.name] = source.value.toString();
        });
      } else {
        throw new Error('MDX: unexpected import source');
      }
    }
  });

  return varToImport;
};

export const plugin = (store: any) => (root: any) => {
  const estree = toEstree(root);
  const varToImport = extractImports(estree);
  const { title, of, name, summary, isTemplate, metaTags } = extractTitle(estree, varToImport);
  store.title = title;
  store.of = of;
  store.name = name;
  store.summary = summary;
  store.isTemplate = isTemplate;
  store.metaTags = metaTags;
  store.imports = Array.from(new Set(Object.values(varToImport)));

  return root;
};

export const analyze = async (code: string): Promise<AnalyzeResult> => {
  const store = {
    title: undefined,
    of: undefined,
    name: undefined,
    summary: undefined,
    isTemplate: false,
    metaTags: undefined,
    imports: undefined,
  } as any;
  const { compile } = await import('@mdx-js/mdx');
  await compile(code, {
    rehypePlugins: [[plugin, store]],
  });

  const { title, of, name, summary, isTemplate, metaTags, imports = [] } = store;
  return { title, of, name, summary, isTemplate, metaTags, imports };
};
