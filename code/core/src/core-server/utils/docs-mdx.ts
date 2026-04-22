import { toEstree } from 'hast-util-to-estree';

type EstreeNode = {
  type: string;
  [key: string]: unknown;
};

type AnalyzeResult = {
  title?: string;
  of?: string;
  name?: string;
  summary?: string;
  isTemplate: boolean;
  metaTags?: string[];
  imports: string[];
};

const getAttr = (elt: EstreeNode, what: string) =>
  (elt.attributes as EstreeNode[] | undefined)?.find(
    (node) => node.type === 'JSXAttribute' && (node.name as EstreeNode).name === what
  );

const getAttrValue = (elt: EstreeNode, what: string) => getAttr(elt, what)?.value;

const getAttrLiteral = (elt: EstreeNode, what: string) => {
  const attrValue = getAttrValue(elt, what);
  if (!attrValue) {
    return undefined;
  }

  if (attrValue.type === 'Literal') {
    return attrValue.value;
  }

  throw new Error(`Expected string literal ${what}, received ${attrValue.type}`);
};

const getOf = (elt: EstreeNode, varToImport: Record<string, string>) => {
  const ofAttrValue = getAttrValue(elt, 'of');

  if (!ofAttrValue) {
    return undefined;
  }

  if (ofAttrValue.type !== 'JSXExpressionContainer') {
    throw new Error(`Expected JSX expression, received ${ofAttrValue.type}`);
  }

  const of = ofAttrValue.expression;
  if (of?.type !== 'Identifier') {
    throw new Error(`Expected identifier, received ${of.type}`);
  }

  const importName = varToImport[of.name];
  if (!importName) {
    throw new Error(`Unknown identifier ${of.name}`);
  }

  return importName;
};

const getTags = (elt: EstreeNode) => {
  const tagsContainer = getAttrValue(elt, 'tags');
  if (!tagsContainer) {
    return undefined;
  }

  if (tagsContainer.type !== 'JSXExpressionContainer') {
    throw new Error(`Expected JSX expression tags, received ${tagsContainer.type}`);
  }

  const tagsArray = tagsContainer.expression;
  if (tagsArray.type !== 'ArrayExpression') {
    throw new Error(`Expected tags array, received ${tagsArray.type}`);
  }

  return (tagsArray.elements as EstreeNode[]).map((tag) => {
    if (tag.type === 'Literal' && typeof tag.value === 'string') {
      return tag.value;
    }

    throw new Error(`Expected string literal tag, received ${tag.type}`);
  });
};

const getIsTemplate = (elt: EstreeNode) => {
  const isTemplateAttr = getAttr(elt, 'isTemplate');
  if (!isTemplateAttr) {
    return false;
  }

  const isTemplate = isTemplateAttr.value;
  if (isTemplate == null) {
    return true;
  }

  if (isTemplate.type === 'JSXExpressionContainer') {
    const expression = isTemplate.expression as EstreeNode;
    if (expression.type === 'Literal' && typeof expression.value === 'boolean') {
      return expression.value;
    }

    throw new Error(`Expected boolean isTemplate, received ${typeof expression.value}`);
  }

  throw new Error(`Expected expression isTemplate, received ${isTemplate.type}`);
};

const extractTitle = (root: EstreeNode, varToImport: Record<string, string>) => {
  const result: Omit<AnalyzeResult, 'imports'> = {
    title: undefined,
    of: undefined,
    name: undefined,
    summary: undefined,
    isTemplate: false,
    metaTags: undefined,
  };

  const fragments = (root.body as EstreeNode[]).filter(
    (child: EstreeNode) =>
      child.type === 'ExpressionStatement' && child.expression?.type === 'JSXFragment'
  );

  if (fragments.length > 1) {
    throw new Error('duplicate contents');
  }

  const fragment = fragments[0]?.expression;
  if (!fragment) {
    return result;
  }

  (fragment.children as EstreeNode[]).forEach((child) => {
    if (child.type === 'JSXElement') {
      const openingElement = child.openingElement as EstreeNode;
      const name = (openingElement.name as EstreeNode).name;

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

export const extractImports = (root: EstreeNode) => {
  const varToImport: Record<string, string> = {};

  (root.body as EstreeNode[]).forEach((child) => {
    if (child.type !== 'ImportDeclaration') {
      return;
    }

    const { source, specifiers } = child;
    if (source.type !== 'Literal') {
      throw new Error('MDX: unexpected import source');
    }

    (specifiers as EstreeNode[]).forEach((specifier) => {
      varToImport[(specifier.local as EstreeNode).name as string] = source.value.toString();
    });
  });

  return varToImport;
};

export const plugin = (store: AnalyzeResult) => (root: unknown) => {
  const estree = toEstree(root) as EstreeNode;
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

let mdxModule: Promise<typeof import('@mdx-js/mdx')> | undefined;

export const analyze = async (code: string): Promise<AnalyzeResult> => {
  const store: AnalyzeResult = {
    title: undefined,
    of: undefined,
    name: undefined,
    summary: undefined,
    isTemplate: false,
    metaTags: undefined,
    imports: [],
  };

  mdxModule ||= import('@mdx-js/mdx');
  const { compile } = await mdxModule;
  await compile(code, {
    rehypePlugins: [[plugin, store]],
  });

  return store;
};
