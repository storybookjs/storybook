/* eslint-disable no-underscore-dangle */
import type { ReactElement, ReactNode } from 'react';
import React, { createElement, isValidElement } from 'react';

import { logger } from 'storybook/internal/client-logger';
import { SNIPPET_RENDERED, SourceType, getDocgenSection } from 'storybook/internal/docs-tools';
import { addons, useEffect } from 'storybook/internal/preview-api';
import type { ArgsStoryFn, PartialStoryFn, StoryContext } from 'storybook/internal/types';

import type { Options } from 'react-element-to-jsx-string';
import reactElementToJSXString from 'react-element-to-jsx-string';

import type { ReactRenderer } from '../types';
import { isForwardRef, isMemo } from './lib';

const toPascalCase = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

/**
 * Converts a React symbol to a React-like displayName
 *
 * Symbols come from here
 * https://github.com/facebook/react/blob/338dddc089d5865761219f02b5175db85c54c489/packages/react-devtools-shared/src/backend/ReactSymbols.js
 *
 * E.g.
 * Symbol(react.suspense)                    -> React.Suspense
 * Symbol(react.strict_mode)                 -> React.StrictMode
 * Symbol(react.server_context.defaultValue) -> React.ServerContext.DefaultValue
 *
 * @param {Symbol} elementType - The symbol to convert
 * @returns {string | null} A displayName for the Symbol in case elementType is a Symbol; otherwise, null.
 */
export const getReactSymbolName = (elementType: any): string => {
  const elementName = elementType.$$typeof || elementType;
  const symbolDescription: string = elementName.toString().replace(/^Symbol\((.*)\)$/, '$1');

  const reactComponentName = symbolDescription
    .split('.')
    .map((segment) => {
      // Split segment by underscore to handle cases like 'strict_mode' separately, and PascalCase them
      return segment.split('_').map(toPascalCase).join('');
    })
    .join('.');
  return reactComponentName;
};

// Recursively remove "_owner" property from elements to avoid crash on docs page when passing components as an array prop (#17482)
// Note: It may be better to use this function only in development environment.
function simplifyNodeForStringify(node: ReactNode): ReactNode {
  if (isValidElement(node)) {
    const props = Object.keys(node.props).reduce<{ [key: string]: any }>((acc, cur) => {
      acc[cur] = simplifyNodeForStringify(node.props[cur]);
      return acc;
    }, {});
    return {
      ...node,
      props,
      // @ts-expect-error (this is an internal or removed api)
      _owner: null,
    };
  }
  if (Array.isArray(node)) {
    return node.map(simplifyNodeForStringify);
  }
  return node;
}

type JSXOptions = Options & {
  /** How many wrappers to skip when rendering the jsx */
  skip?: number;
  /** Whether to show the function in the jsx tab */
  showFunctions?: boolean;
  /** Whether to format HTML or Vue markup */
  enableBeautify?: boolean;
  /** Override the display name used for a component */
  displayName?: string | Options['displayName'];
};

/** Apply the users parameters and render the jsx for a story */
export const renderJsx = (code: React.ReactElement, options?: JSXOptions) => {
  if (typeof code === 'undefined') {
    logger.warn('Too many skip or undefined component');
    return null;
  }

  let renderedJSX = code;
  const Type = renderedJSX.type;

  // @ts-expect-error (Converted from ts-ignore)
  for (let i = 0; i < options?.skip; i += 1) {
    if (typeof renderedJSX === 'undefined') {
      logger.warn('Cannot skip undefined element');
      return null;
    }

    if (React.Children.count(renderedJSX) > 1) {
      logger.warn('Trying to skip an array of elements');
      return null;
    }

    if (typeof renderedJSX.props.children === 'undefined') {
      logger.warn('Not enough children to skip elements.');

      if (typeof renderedJSX.type === 'function' && renderedJSX.type.name === '') {
        renderedJSX = <Type {...renderedJSX.props} />;
      }
    } else if (typeof renderedJSX.props.children === 'function') {
      renderedJSX = renderedJSX.props.children();
    } else {
      renderedJSX = renderedJSX.props.children;
    }
  }

  let displayNameDefaults;

  if (typeof options?.displayName === 'string') {
    displayNameDefaults = { showFunctions: true, displayName: () => options.displayName };
    /**
     * add `renderedJSX?.type`to handle this case:
     *
     * https://github.com/zhyd1997/storybook/blob/20863a75ba4026d7eba6b288991a2cf091d4dfff/code/renderers/react/template/stories/errors.stories.tsx#L14
     *
     * or it show the error message when run `yarn build-storybook --quiet`:
     *
     * Cannot read properties of undefined (reading '__docgenInfo').
     */
  } else {
    displayNameDefaults = {
      // To get exotic component names resolving properly
      displayName: (el: any): string => {
        if (el.type.displayName) {
          return el.type.displayName;
        } else if (getDocgenSection(el.type, 'displayName')) {
          return getDocgenSection(el.type, 'displayName');
        } else if (el.type.render?.displayName) {
          return el.type.render.displayName;
        } else if (
          typeof el.type === 'symbol' ||
          (el.type.$$typeof && typeof el.type.$$typeof === 'symbol')
        ) {
          return getReactSymbolName(el.type);
        } else if (el.type.name && el.type.name !== '_default') {
          return el.type.name;
        } else if (typeof el.type === 'function') {
          return 'No Display Name';
        } else if (isForwardRef(el.type)) {
          return el.type.render.name;
        } else if (isMemo(el.type)) {
          return el.type.type.name;
        } else {
          return el.type;
        }
      },
    };
  }

  const filterDefaults = {
    filterProps: (value: any, key: string): boolean => value !== undefined,
  };

  const opts = {
    ...displayNameDefaults,
    ...filterDefaults,
    ...options,
  };

  const result = React.Children.map(code, (c) => {
    // @ts-expect-error FIXME: workaround react-element-to-jsx-string
    const child = typeof c === 'number' ? c.toString() : c;
    const toJSXString =
      typeof reactElementToJSXString === 'function'
        ? reactElementToJSXString
        : // @ts-expect-error (Converted from ts-ignore)
          reactElementToJSXString.default;
    let string: string = toJSXString(simplifyNodeForStringify(child), opts as Options);

    if (string.indexOf('&quot;') > -1) {
      const matches = string.match(/\S+=\\"([^"]*)\\"/g);
      if (matches) {
        matches.forEach((match) => {
          string = string.replace(match, match.replace(/&quot;/g, "'"));
        });
      }
    }

    return string;
  }).join('\n');

  return result.replace(/function\s+noRefCheck\(\)\s*\{\}/g, '() => {}');
};

const defaultOpts = {
  skip: 0,
  showFunctions: false,
  enableBeautify: true,
  showDefaultProps: false,
};

export const skipJsxRender = (context: StoryContext<ReactRenderer>) => {
  const sourceParams = context?.parameters.docs?.source;
  const isArgsStory = context?.parameters.__isArgsStory;

  // always render if the user forces it
  if (sourceParams?.type === SourceType.DYNAMIC) {
    return false;
  }

  // never render if the user is forcing the block to render code, or
  // if the user provides code, or if it's not an args story.
  return !isArgsStory || sourceParams?.code || sourceParams?.type === SourceType.CODE;
};

const isMdx = (node: any) => node.type?.displayName === 'MDXCreateElement' && !!node.props?.mdxType;

const mdxToJsx = (node: any) => {
  if (!isMdx(node)) return node;
  const { mdxType, originalType, children, ...rest } = node.props;
  let jsxChildren = [] as ReactElement[];
  if (children) {
    const array = Array.isArray(children) ? children : [children];
    jsxChildren = array.map(mdxToJsx);
  }
  return createElement(originalType, rest, ...jsxChildren);
};

export const jsxDecorator = (
  storyFn: PartialStoryFn<ReactRenderer>,
  context: StoryContext<ReactRenderer>
) => {
  const channel = addons.getChannel();
  const skip = skipJsxRender(context);

  let jsx = '';

  useEffect(() => {
    if (!skip) {
      const { id, unmappedArgs } = context;
      channel.emit(SNIPPET_RENDERED, {
        id,
        source: jsx,
        args: unmappedArgs,
      });
    }
  });

  const story = storyFn();
  // We only need to render JSX if the source block is actually going to
  // consume it. Otherwise it's just slowing us down.
  if (skip) {
    return story;
  }

  const options = {
    ...defaultOpts,
    ...(context?.parameters.jsx || {}),
  } as Required<JSXOptions>;

  // Exclude decorators from source code snippet by default
  const storyJsx = context?.parameters.docs?.source?.excludeDecorators
    ? (context.originalStoryFn as ArgsStoryFn<ReactRenderer>)(context.args, context)
    : story;

  const sourceJsx = mdxToJsx(storyJsx);

  const rendered = renderJsx(sourceJsx, options);
  if (rendered) {
    jsx = rendered;
  }

  return story;
};
