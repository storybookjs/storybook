import { type CsfEnricher } from 'storybook/internal/types';

import type { CsfFile } from './CsfFile.ts';
import { type E, type Node, identifierKey } from './estree/ast.ts';
import {
  type SourceEditor,
  appendMembers,
  appendStatement,
  prependMembers,
} from './estree/editor.ts';

export interface EnrichCsfOptions {
  disableSource?: boolean;
  disableDescription?: boolean;
  enrichCsf?: CsfEnricher;
}

export const enrichCsfStory = (
  csf: CsfFile,
  csfSource: CsfFile,
  key: string,
  options?: EnrichCsfOptions
) => {
  const storyExport = csfSource.getStoryExport(key);
  const source = !options?.disableSource && extractSource(storyExport, csfSource._code);
  const description =
    !options?.disableDescription &&
    extractDescription(csfSource._storyStatements[key], csfSource._editor);
  // in csf 1/2/3 use Story.parameters; CSF factories use Story.input.parameters
  const originalParameters = csfSource._metaIsFactory
    ? `${key}.input.parameters`
    : `${key}.parameters`;
  const optionalDocs = `${originalParameters}?.docs`;
  const extraDocsParameters: string[] = [];

  // docs: { source: { originalSource: %%source%% } },
  if (source) {
    extraDocsParameters.push(
      `source: { originalSource: ${JSON.stringify(source)}, ...${optionalDocs}?.source }`
    );
  }

  // docs: { description: { story: %%description%% } },
  if (description) {
    extraDocsParameters.push(
      `description: { story: ${JSON.stringify(description)}, ...${optionalDocs}?.description }`
    );
  }

  if (extraDocsParameters.length > 0) {
    appendStatement(
      csf._editor,
      `${originalParameters} = { ...${originalParameters}, docs: { ...${optionalDocs}, ${extraDocsParameters.join(', ')} } };`
    );
  }
};

const addComponentDescription = (
  editor: SourceEditor,
  node: E.ObjectExpression,
  path: string[],
  value: string
) => {
  if (!path.length) {
    const hasExistingComponent = node.properties.some(
      (p) => p.type === 'Property' && identifierKey(p) === 'component'
    );
    if (!hasExistingComponent) {
      // make this the lowest-priority so that if the user is object-spreading on top of it,
      // the users' code will "win"
      prependMembers(editor, node, [`component: ${value}`]);
    }
    return;
  }
  const [first, ...rest] = path;
  const existing = node.properties.find(
    (p): p is E.ObjectProperty =>
      p.type === 'Property' && identifierKey(p) === first && p.value.type === 'ObjectExpression'
  );
  if (existing) {
    addComponentDescription(editor, existing.value as E.ObjectExpression, rest, value);
    return;
  }
  const nested = rest.reduceRight(
    (inner, key) => `{ ${key}: ${inner} }`,
    `{ component: ${value} }`
  );
  appendMembers(editor, node, [`${first}: ${nested}`]);
};

export const enrichCsfMeta = (csf: CsfFile, csfSource: CsfFile, options?: EnrichCsfOptions) => {
  const description =
    !options?.disableDescription && extractDescription(csfSource._metaStatement, csfSource._editor);
  // docs: { description: { component: %%description%% } },
  if (description) {
    const metaNode = csf._metaNode;
    if (metaNode && !csf._metaNodeIsSynthetic) {
      addComponentDescription(
        csf._editor,
        metaNode,
        ['parameters', 'docs', 'description'],
        JSON.stringify(description)
      );
    }
  }
};

/**
 * Add `docs.source.originalSource` and JSDoc descriptions to a parsed CSF file. Edits accumulate
 * on `csf`; print them with `formatCsf(csf, { sourceMaps: true })`.
 */
export const enrichCsf = async (csf: CsfFile, csfSource: CsfFile, options?: EnrichCsfOptions) => {
  enrichCsfMeta(csf, csfSource, options);
  await options?.enrichCsf?.(csf, csfSource);
  Object.keys(csf._storyExports).forEach((key) => {
    enrichCsfStory(csf, csfSource, key, options);
  });
};

// The story's own source text: the initializer of `const X = …`, or the function itself.
export const extractSource = (node: Node, code: string) => {
  const src = (node?.type === 'VariableDeclarator' ? node.init : node) as
    | { start: number; end: number }
    | null
    | undefined;
  return src ? code.slice(src.start, src.end) : '';
};

// Comments directly preceding a node, like Babel's `leadingComments`.
export const leadingComments = (node: Node | undefined, editor: SourceEditor) => {
  const start = (node as { start?: number } | undefined)?.start;
  if (start === undefined) {
    return [];
  }
  const comments: E.Comment[] = [];
  let position = start;
  for (let index = editor.comments.length - 1; index >= 0; index--) {
    const comment = editor.comments[index];
    if (comment.end > position) {
      continue;
    }
    if (editor.code.slice(comment.end, position).trim()) {
      break;
    }
    comments.unshift(comment);
    position = comment.start;
  }
  return comments;
};

export const extractDescription = (node: Node | undefined, editor: SourceEditor) => {
  const comments = leadingComments(node, editor)
    .map((comment) => {
      if (comment.type === 'Line' || !comment.value.startsWith('*')) {
        return null;
      }
      return (
        comment.value
          .split('\n')
          // remove leading *'s and spaces from the beginning of each line
          .map((line) => line.replace(/^(\s+)?(\*+)?(\s)?/, ''))
          .join('\n')
          .trim()
      );
    })
    .filter(Boolean);
  return comments.join('\n');
};
