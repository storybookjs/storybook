import type { Block, Spec } from 'comment-parser';
import type { RootResult as JSDocType } from 'jsdoc-type-pratt-parser';
import { parse as parseJSDoc } from 'comment-parser';
import {
  parse as parseJSDocType,
  transform as transformJSDocType,
  stringifyRules,
} from 'jsdoc-type-pratt-parser';
import type { JsDocParam, JsDocReturns } from './docgen';

export interface ExtractedJsDocParam extends JsDocParam {
  type?: any;
  getPrettyName: () => string | undefined;
  getTypeName: () => string | null;
}

export interface ExtractedJsDocReturns extends JsDocReturns {
  type?: any;
  getTypeName: () => string | null;
}

export interface ExtractedJsDoc {
  params?: ExtractedJsDocParam[] | null;
  deprecated?: string | null;
  returns?: ExtractedJsDocReturns | null;
  ignore: boolean;
}

export interface JsDocParsingOptions {
  tags?: string[];
}

export interface JsDocParsingResult {
  includesJsDoc: boolean;
  ignore: boolean;
  description?: string;
  extractedTags?: ExtractedJsDoc;
}

export type ParseJsDoc = (
  value: string | null,
  options?: JsDocParsingOptions
) => JsDocParsingResult;

function containsJsDoc(value?: string | null): boolean {
  return value != null && value.includes('@');
}

function parse(content: string | null): Block {
  const contentString = content ?? '';
  const mappedLines = contentString
    .split('\n')
    .map((line) => ` * ${line}`)
    .join('\n');
  const normalisedContent = '/**\n' + mappedLines + '\n*/';

  const ast = parseJSDoc(normalisedContent, {
    spacing: 'preserve',
  });

  if (!ast || ast.length === 0) {
    throw new Error('Cannot parse JSDoc tags.');
  }

  // Return the first block, since we shouldn't ever really encounter
  // multiple blocks of JSDoc
  return ast[0];
}

const DEFAULT_OPTIONS = {
  tags: ['param', 'arg', 'argument', 'returns', 'ignore', 'deprecated'],
};

export const parseJsDoc: ParseJsDoc = (value, options = DEFAULT_OPTIONS) => {
  if (!containsJsDoc(value)) {
    return {
      includesJsDoc: false,
      ignore: false,
    };
  }

  const jsDocAst = parse(value);

  const extractedTags = extractJsDocTags(jsDocAst, options.tags);

  if (extractedTags.ignore) {
    // There is no point in doing other stuff since this prop will not be rendered.
    return {
      includesJsDoc: true,
      ignore: true,
    };
  }

  return {
    includesJsDoc: true,
    ignore: false,
    // Always use the parsed description to ensure JSDoc is removed from the description.
    description: jsDocAst.description.trim(),
    extractedTags,
  };
};

function extractJsDocTags(ast: Block, tags?: string[]): ExtractedJsDoc {
  const extractedTags: ExtractedJsDoc = {
    params: null,
    deprecated: null,
    returns: null,
    ignore: false,
  };

  for (const tagSpec of ast.tags) {
    // Skip any tags we don't care about
    if (tags !== undefined && !tags.includes(tagSpec.tag)) {
      continue;
    }

    if (tagSpec.tag === 'ignore') {
      extractedTags.ignore = true;
      // Once we reach an @ignore tag, there is no point in parsing the other tags since we will not render the prop.
      break;
    } else {
      switch (tagSpec.tag) {
        // arg & argument are aliases for param.
        case 'param':
        case 'arg':
        case 'argument': {
          const paramTag = extractParam(tagSpec);
          if (paramTag != null) {
            if (extractedTags.params == null) {
              extractedTags.params = [];
            }
            extractedTags.params.push(paramTag);
          }
          break;
        }
        case 'deprecated': {
          const deprecatedTag = extractDeprecated(tagSpec);
          if (deprecatedTag != null) {
            extractedTags.deprecated = deprecatedTag;
          }
          break;
        }
        case 'returns': {
          const returnsTag = extractReturns(tagSpec);
          if (returnsTag != null) {
            extractedTags.returns = returnsTag;
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return extractedTags;
}

function normaliseParamName(name: string): string {
  return name.replace(/[\.-]$/, '');
}

function extractParam(tag: Spec): ExtractedJsDocParam | null {
  // Ignore tags with empty names or `-`.
  // We ignore `-` since it means a comment was likely missing a name but
  // using separators. For example: `@param {foo} - description`
  if (!tag.name || tag.name === '-') {
    return null;
  }

  const type = extractType(tag.type);

  return {
    name: tag.name,
    type: type,
    description: normaliseDescription(tag.description),
    getPrettyName: () => {
      return normaliseParamName(tag.name);
    },
    getTypeName: () => {
      return type ? extractTypeName(type) : null;
    },
  };
}

function extractDeprecated(tag: Spec): string | null {
  if (tag.name) {
    return joinNameAndDescription(tag.name, tag.description);
  }

  return null;
}

function joinNameAndDescription(name: string, desc: string): string | null {
  const joined = name === '' ? desc : `${name} ${desc}`;
  return normaliseDescription(joined);
}

function normaliseDescription(text: string): string | null {
  const normalised = text.replace(/^- /g, '').trim();

  return normalised === '' ? null : normalised;
}

function extractReturns(tag: Spec): ExtractedJsDocReturns | null {
  const type = extractType(tag.type);

  if (type) {
    return {
      type: type,
      description: joinNameAndDescription(tag.name, tag.description),
      getTypeName: () => {
        return extractTypeName(type);
      },
    };
  }

  return null;
}

const jsdocStringifyRules = stringifyRules();
const originalJsdocStringifyObject = jsdocStringifyRules.JsdocTypeObject;
jsdocStringifyRules.JsdocTypeAny = () => 'any';
jsdocStringifyRules.JsdocTypeObject = (result, transform) =>
  `(${originalJsdocStringifyObject(result, transform)})`;
jsdocStringifyRules.JsdocTypeOptional = (result, transform) => transform(result.element);
jsdocStringifyRules.JsdocTypeNullable = (result, transform) => transform(result.element);
jsdocStringifyRules.JsdocTypeNotNullable = (result, transform) => transform(result.element);
jsdocStringifyRules.JsdocTypeUnion = (result, transform) =>
  result.elements.map(transform).join('|');

function extractType(typeString: string): JSDocType | null {
  try {
    return parseJSDocType(typeString, 'typescript');
  } catch (_err) {
    return null;
  }
}

function extractTypeName(type: JSDocType): string {
  return transformJSDocType(jsdocStringifyRules, type);
}
