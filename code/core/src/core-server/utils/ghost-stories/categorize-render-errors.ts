import {
  isI18nPackage,
  isRouterPackage,
  isStateManagementPackage,
  isStylingPackage,
} from '../../../telemetry/ecosystem-identifier';
import type { StoryTestResult } from './types';

export interface CategorizedError {
  category: ErrorCategory;
  description: string;
  count: number;
  examples: string[];
  matchedDependencies: string[];
}

export interface ErrorCategorizationResult {
  totalErrors: number;
  categorizedErrors: CategorizedError[];
}

export const ERROR_CATEGORIES = {
  MISSING_PROVIDER: 'Missing Provider',
  MISSING_STATE_PROVIDER: 'Missing State Provider',
  MISSING_ROUTER_PROVIDER: 'Missing Router Provider',
  MISSING_THEME_PROVIDER: 'Missing Theme Provider',
  MISSING_TRANSLATION_PROVIDER: 'Missing Translation Provider',
  MISSING_PORTAL_ROOT: 'Missing Portal Root',
  HOOK_USAGE_ERROR: 'Hook Usage Error',
  MODULE_IMPORT_ERROR: 'Module Import Error',
  COMPONENT_RENDER_ERROR: 'Component Render Error',
  UNKNOWN_ERROR: 'Unknown Error',
} as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[keyof typeof ERROR_CATEGORIES];

export interface ErrorContext {
  message: string;
  stack?: string;

  normalizedMessage: string;
  normalizedStack: string;

  stackDeps: Set<string>;
}

interface CategorizationRule {
  category: ErrorCategory;
  priority: number;
  match: (ctx: ErrorContext) => boolean;
}

// From a message and stack, return a context for each category matchers
function buildErrorContext(message: string, stack?: string): ErrorContext {
  const normalizedMessage = message.toLowerCase();
  const normalizedStack = (stack ?? '').toLowerCase();

  const stackDeps = new Set<string>();

  for (const line of normalizedStack.split('\n')) {
    const depMatch = line.match(/\/deps\/([^/.]+)\.js/);
    if (depMatch) {
      stackDeps.add(depMatch[1]);
    }
  }

  return {
    message,
    stack,
    normalizedMessage,
    normalizedStack,
    stackDeps,
  };
}

/**
 * Each rule is a category matcher with a priority. The higher the priority, the more specific the
 * rule is. For instance you might have an error message that matches two categories
 *
 * E.g. "cannot find module theme".
 *
 * In this case, it's more of a module import error than a theme provider error.
 *
 * Each matcher combines doing simple checks based on error message but also fallback to checking
 * existence of specific dependency names in the stack, as sometimes an error message isn't enough.
 *
 * E.g. "Cannot read properties of undefined (reading 'theme')" at /deps/styled-components.js
 */
const DEFAULT_RULES: CategorizationRule[] = [
  {
    category: ERROR_CATEGORIES.MODULE_IMPORT_ERROR,
    priority: 100,
    match: (ctx) =>
      ctx.normalizedMessage.includes('cannot find module') ||
      ctx.normalizedMessage.includes('module not found') ||
      ctx.normalizedMessage.includes('cannot resolve module'),
  },

  {
    category: ERROR_CATEGORIES.HOOK_USAGE_ERROR,
    priority: 90,
    match: (ctx) =>
      ctx.normalizedMessage.includes('invalid hook call') ||
      ctx.normalizedMessage.includes('rendered more hooks than') ||
      ctx.normalizedMessage.includes('hooks can only be called'),
  },

  {
    category: ERROR_CATEGORIES.MISSING_STATE_PROVIDER,
    priority: 85,
    match: (ctx) =>
      Array.from(ctx.stackDeps).some(isStateManagementPackage) &&
      (ctx.normalizedMessage.includes('context') ||
        ctx.normalizedMessage.includes('undefined') ||
        ctx.normalizedMessage.includes('null')),
  },

  {
    category: ERROR_CATEGORIES.MISSING_ROUTER_PROVIDER,
    priority: 85,
    match: (ctx) =>
      Array.from(ctx.stackDeps).some(isRouterPackage) ||
      ctx.normalizedMessage.includes('usenavigate') ||
      ctx.normalizedMessage.includes('router'),
  },

  {
    category: ERROR_CATEGORIES.MISSING_THEME_PROVIDER,
    priority: 80,
    match: (ctx) =>
      (Array.from(ctx.stackDeps).some(isStylingPackage) &&
        (ctx.normalizedMessage.includes('theme') || ctx.normalizedMessage.includes('undefined'))) ||
      ctx.normalizedMessage.includes('usetheme') ||
      (ctx.normalizedMessage.includes('theme') && ctx.normalizedMessage.includes('provider')),
  },

  {
    category: ERROR_CATEGORIES.MISSING_TRANSLATION_PROVIDER,
    priority: 80,
    match: (ctx) =>
      Array.from(ctx.stackDeps).some(isI18nPackage) ||
      ctx.normalizedMessage.includes('i18n') ||
      ctx.normalizedMessage.includes('translation') ||
      ctx.normalizedMessage.includes('locale'),
  },

  {
    category: ERROR_CATEGORIES.MISSING_PORTAL_ROOT,
    priority: 70,
    match: (ctx) =>
      ctx.normalizedMessage.includes('portal') &&
      (ctx.normalizedMessage.includes('container') || ctx.normalizedMessage.includes('root')) &&
      (ctx.normalizedMessage.includes('null') || ctx.normalizedMessage.includes('not found')),
  },

  {
    category: ERROR_CATEGORIES.MISSING_PROVIDER,
    priority: 60,
    match: (ctx) =>
      ctx.normalizedMessage.includes('usecontext') &&
      (ctx.normalizedMessage.includes('null') || ctx.normalizedMessage.includes('undefined')),
  },

  {
    category: ERROR_CATEGORIES.COMPONENT_RENDER_ERROR,
    priority: 10,
    match: (ctx) =>
      ctx.normalizedMessage.includes('cannot read') ||
      ctx.normalizedMessage.includes('undefined is not a function') ||
      ctx.normalizedMessage.includes('render'),
  },
];

/**
 * For a given error, return which category and which whitelisted dependencies of that category were
 * matched in the stack trace
 */
export function categorizeError(
  message: string,
  stack?: string
): { category: ErrorCategory; matchedDependencies: string[] } {
  const rules = DEFAULT_RULES.sort((a, b) => b.priority - a.priority);
  const ctx = buildErrorContext(message, stack);
  const rule = rules.find((r) => r.match(ctx));

  if (!rule) {
    return { category: ERROR_CATEGORIES.UNKNOWN_ERROR, matchedDependencies: [] };
  }

  // Extract matched dependencies based on the category
  const matchedDependencies = getMatchedDependencies(rule.category, ctx);
  return { category: rule.category, matchedDependencies };
}

function getMatchedDependencies(category: ErrorCategory, ctx: ErrorContext): string[] {
  switch (category) {
    case ERROR_CATEGORIES.MISSING_STATE_PROVIDER:
      return Array.from(ctx.stackDeps).filter(isStateManagementPackage);
    case ERROR_CATEGORIES.MISSING_ROUTER_PROVIDER:
      return Array.from(ctx.stackDeps).filter(isRouterPackage);
    case ERROR_CATEGORIES.MISSING_THEME_PROVIDER:
      return Array.from(ctx.stackDeps).filter(isStylingPackage);
    case ERROR_CATEGORIES.MISSING_TRANSLATION_PROVIDER:
      return Array.from(ctx.stackDeps).filter(isI18nPackage);
    default:
      return [];
  }
}

/** For a given category, return a description of the error for better legibility. */
function getCategoryDescription(category: ErrorCategory): string {
  switch (category) {
    case ERROR_CATEGORIES.MISSING_STATE_PROVIDER:
      return 'Component attempted to access shared state without a state management provider';

    case ERROR_CATEGORIES.MISSING_ROUTER_PROVIDER:
      return 'Component attempted to access routing context without a router provider';

    case ERROR_CATEGORIES.MISSING_THEME_PROVIDER:
      return 'Component attempted to access theme values without a theme provider';

    case ERROR_CATEGORIES.MISSING_TRANSLATION_PROVIDER:
      return 'Component attempted to access translations without a translation provider';

    case ERROR_CATEGORIES.MISSING_PROVIDER:
      return 'Component attempted to access React context without a matching provider';

    case ERROR_CATEGORIES.MISSING_PORTAL_ROOT:
      return 'Component attempted to render a portal without a valid DOM container';

    case ERROR_CATEGORIES.HOOK_USAGE_ERROR:
      return 'React hook was used incorrectly';

    case ERROR_CATEGORIES.MODULE_IMPORT_ERROR:
      return 'A required dependency could not be resolved';

    case ERROR_CATEGORIES.COMPONENT_RENDER_ERROR:
      return 'Component failed during render due to a runtime error';

    default:
      return 'Error could not be categorized';
  }
}

/**
 * For a given list of test results:
 *
 * - Go through failures
 * - Categorize errors into categories
 * - Return structured data about the run, with categorized errors instead of the actual error
 *   messages
 */
export function extractUniqueCategorizedErrors(
  testResults: StoryTestResult[]
): ErrorCategorizationResult {
  const failed = testResults.filter((r) => r.status === 'FAIL' && r.error);

  const map = new Map<
    ErrorCategory,
    { count: number; examples: Set<string>; matchedDependencies: Set<string> }
  >();

  for (const r of failed) {
    const { category, matchedDependencies } = categorizeError(r.error!, r.stack);
    const example = r.error!.slice(0, 100);

    if (!map.has(category)) {
      map.set(category, { count: 0, examples: new Set(), matchedDependencies: new Set() });
    }

    const data = map.get(category)!;
    data.count++;
    data.examples.add(example);
    matchedDependencies.forEach((dep) => data.matchedDependencies.add(dep));
  }

  const categorizedErrors = Array.from(map.entries())
    .map(([category, data]) => ({
      category,
      description: getCategoryDescription(category),
      count: data.count,
      examples: Array.from(data.examples).slice(0, 3),
      matchedDependencies: Array.from(data.matchedDependencies).sort(),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalErrors: failed.length,
    categorizedErrors,
  };
}
