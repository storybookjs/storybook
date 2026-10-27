import { EXCLUDED_PSEUDO_ELEMENT_PATTERNS, PSEUDO_STATES } from '../constants.ts';
import { splitSelectors } from './splitSelectors.ts';

const pseudoStates = Object.values(PSEUDO_STATES);
// Pseudoclass parameters opening parenthesis plus combinators and separators from https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Selectors#combinators_and_separators
const selectorStartPattern = /[|>+~,\s(]/;
// WebKit is especially slow at evaluating the previous variable-length lookbehinds across large
// stylesheets. Match candidates once, then validate escapes and pseudo-element context by index.
const pseudoStatePattern = new RegExp(`:(${pseudoStates.join('|')})`, 'g');
const excludedPseudoElementPattern = new RegExp(
  `(?:${EXCLUDED_PSEUDO_ELEMENT_PATTERNS.join('|')})\\S*`,
  'g'
);

type PseudoStateMatch = {
  index: number;
  state: string;
  text: string;
};

type IndexRange = {
  start: number;
  end: number;
};

const isEscaped = (selector: string, index: number) => {
  let precedingBackslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && selector[cursor] === '\\'; cursor--) {
    precedingBackslashes++;
  }
  return precedingBackslashes % 2 === 1;
};

const findPseudoStates = (selector: string) => {
  const matches: PseudoStateMatch[] = [];
  pseudoStatePattern.lastIndex = 0;

  let match = pseudoStatePattern.exec(selector);
  while (match) {
    const index = match.index;
    if (!isEscaped(selector, index)) {
      matches.push({ index, state: match[1], text: match[0] });
    }
    match = pseudoStatePattern.exec(selector);
  }

  return matches;
};

const findExcludedPseudoElementRanges = (selector: string) => {
  const ranges: IndexRange[] = [];
  excludedPseudoElementPattern.lastIndex = 0;

  let match = excludedPseudoElementPattern.exec(selector);
  while (match) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
    match = excludedPseudoElementPattern.exec(selector);
  }

  return ranges;
};

const replacePseudoStateMatches = (
  selector: string,
  matches: PseudoStateMatch[],
  replacement: (state: string) => string
) => {
  let result = '';
  let cursor = 0;

  matches.forEach((match) => {
    result += selector.slice(cursor, match.index);
    result += replacement(match.state);
    cursor = match.index + match.text.length;
  });

  return result + selector.slice(cursor);
};

// WebKit limits a style rule to 4096 selectors. Keep some headroom so rewritten rules remain
// valid even after pseudo-state selectors are expanded.
const maximumSelectorsPerRule = 4000;

const warnings = new Set();
const warnOnce = (message: string) => {
  if (warnings.has(message)) {
    return;
  }

  console.warn(message);
  warnings.add(message);
};

const replacePseudoStates = (
  selector: string,
  allClass?: boolean,
  pseudoStateMatches = findPseudoStates(selector)
) => {
  const excludedRanges = findExcludedPseudoElementRanges(selector);
  const matches = pseudoStateMatches.filter(
    ({ index }) => !excludedRanges.some(({ start, end }) => index >= start && index < end)
  );

  return replacePseudoStateMatches(
    selector,
    matches,
    (state) => `.pseudo-${state}${allClass ? '-all' : ''}`
  );
};

// Does not handle :host() or :not() containing pseudo-states. Need to call replaceNotSelectors on the input first.
const replacePseudoStatesWithAncestorSelector = (
  selector: string,
  forShadowDOM: boolean,
  additionalHostSelectors?: string
) => {
  const extracted = extractPseudoStates(selector);
  if (extracted.states.length === 0 && !additionalHostSelectors) {
    return selector;
  }

  const selectors = `${additionalHostSelectors ?? ''}${extracted.states.map((s) => `.pseudo-${s}-all`).join('')}`;

  // If there was a :host-context() containing only pseudo-states, we will later add a :host selector that replaces it.
  let { withoutPseudoStates } = extracted;
  withoutPseudoStates = withoutPseudoStates.replace(':host-context(*)', '').trimStart();

  // If there is a :host-context() selector, we don't need to introduce a :host() selector.
  // We can just append the pseudo-state classes to the :host-context() selector.
  return withoutPseudoStates.startsWith(':host-context(')
    ? withoutPseudoStates.replace(/^(:host-context\(\S+\))/, `$1${selectors}`)
    : forShadowDOM
      ? `:host(${selectors}) ${withoutPseudoStates}`
      : `${selectors} ${withoutPseudoStates}`;
};

const extractPseudoStates = (selector: string) => {
  const states = new Set<string>();
  const matches = findPseudoStates(selector);
  let withoutPseudoStates = '';
  let cursor = 0;

  matches.forEach((match) => {
    withoutPseudoStates += selector.slice(cursor, match.index);
    if (match.index > 0 && selectorStartPattern.test(selector[match.index - 1])) {
      withoutPseudoStates += '*';
    }
    states.add(match.state);
    cursor = match.index + match.text.length;
  });
  withoutPseudoStates += selector.slice(cursor);

  // If a selector list was left with blank items (e.g. ", foo, , bar, "), remove the extra commas/spaces.
  withoutPseudoStates = withoutPseudoStates.replaceAll(/([\s(]),\s+|(,\s+)+(?=\))/g, '$1') || '*';

  return {
    states: Array.from(states),
    withoutPseudoStates,
  };
};

const rewriteNotSelectors = (selector: string, forShadowDOM: boolean) => {
  // Accept up to 3 levels of nested parentheses.
  return [...selector.matchAll(/:not\((?:[^()]|\([^()]+\)|\((?:[^()]|\([^()]+\))+\))+\)/g)].reduce(
    (acc, [originalNot]) => {
      const selectorList = originalNot.match(/^:not\((.+)\)$/)?.[1] ?? '';
      const rewrittenNot = rewriteNotSelector(selectorList, forShadowDOM);
      return acc.replace(originalNot, rewrittenNot);
    },
    selector
  );
};

const rewriteNotSelector = (negatedSelectorList: string, forShadowDOM: boolean) => {
  const rewrittenSelectors: string[] = [];
  // For each negated selector
  for (const negatedSelector of negatedSelectorList.split(/,\s*/)) {
    // :not cannot be nested and cannot contain pseudo-elements, so no need to worry about that.
    // Also, there's no compelling use case for :host() inside :not(), so we don't handle that.
    rewrittenSelectors.push(replacePseudoStatesWithAncestorSelector(negatedSelector, forShadowDOM));
  }
  return `:not(${rewrittenSelectors.join(', ')})`;
};

const rewriteRules = ({ cssText, selectorText }: CSSStyleRule, forShadowDOM: boolean) => {
  let didRewrite = false;
  const rewrittenSelectors = splitSelectors(selectorText).flatMap((selector) => {
    if (selector.includes('.pseudo-')) {
      return [selector];
    }
    const replacementSelectors = [selector];
    const pseudoStateMatches = findPseudoStates(selector);
    if (pseudoStateMatches.length === 0) {
      return replacementSelectors;
    }
    didRewrite = true;

    const classSelector = replacePseudoStates(selector, false, pseudoStateMatches);
    if (classSelector !== selector) {
      replacementSelectors.push(classSelector);
    }

    let ancestorSelector = '';

    if (selector.startsWith(':host(')) {
      const matches = selector.match(/^:host\((\S+)\)\s+(.+)$/);
      if (matches && findPseudoStates(matches[2]).length > 0) {
        // Simple replacement won't work on pseudo-state selectors outside of :host().
        // E.g. :host(.foo) .bar:hover -> :host(.foo.pseudo-hover-all) .bar
        // E.g. :host(.foo:focus) .bar:hover -> :host(.foo.pseudo-focus-all.pseudo-hover-all) .bar
        let hostInnerSelector = matches[1];
        let descendantSelector = matches[2];
        // Simple replacement is fine for pseudo-state selectors inside :host() (even if inside :not()).
        hostInnerSelector = replacePseudoStates(hostInnerSelector, true);
        // Rewrite any :not selectors in the descendant selector.
        descendantSelector = rewriteNotSelectors(descendantSelector, true);
        // Any remaining pseudo-states in the descendant selector need to be moved into the host selector.
        ancestorSelector = replacePseudoStatesWithAncestorSelector(
          descendantSelector,
          true,
          hostInnerSelector
        );
      } else {
        // Don't need to specially handle :not() because:
        //  - if inside :host(), simple replacement is sufficient
        //  - if outside :host(), didn't match any pseudo-states
        ancestorSelector = replacePseudoStates(selector, true);
      }
    } else {
      const withNotsReplaced = rewriteNotSelectors(selector, forShadowDOM);
      ancestorSelector = replacePseudoStatesWithAncestorSelector(withNotsReplaced, forShadowDOM);
    }
    replacementSelectors.push(ancestorSelector);

    return replacementSelectors;
  });

  if (!didRewrite) {
    return [];
  }

  const rewrittenRules: string[] = [];
  for (let index = 0; index < rewrittenSelectors.length; index += maximumSelectorsPerRule) {
    const chunk = rewrittenSelectors.slice(index, index + maximumSelectorsPerRule).join(', ');
    rewrittenRules.push(cssText.replace(selectorText, () => chunk));
  }

  return rewrittenRules;
};

const replaceRule = (
  ruleContainer: CSSStyleSheet | CSSGroupingRule,
  index: number,
  newRules: string[]
) => {
  let insertedRules = 0;
  try {
    newRules.forEach((newRule, offset) => {
      ruleContainer.insertRule(newRule, index + offset + 1);
      insertedRules++;
    });
    ruleContainer.deleteRule(index);
  } catch (error) {
    while (insertedRules > 0) {
      ruleContainer.deleteRule(index + 1);
      insertedRules--;
    }
    throw error;
  }

  return Array.from(ruleContainer.cssRules).slice(index, index + newRules.length) as CSSStyleRule[];
};

// Rewrites the style sheet to add alternative selectors for any rule that targets a pseudo state.
// A sheet can only be rewritten once, and may carry over between stories.
export const rewriteStyleSheet = (sheet: CSSStyleSheet, forShadowDOM = false): boolean => {
  try {
    const maximumRulesToRewrite = 1000;
    const count = rewriteRuleContainer(sheet, maximumRulesToRewrite, forShadowDOM);

    if (count >= maximumRulesToRewrite) {
      warnOnce('Reached maximum of 1000 pseudo selectors per sheet, skipping the rest.');
    }

    return count > 0;
  } catch (e) {
    if (String(e).includes('cssRules')) {
      warnOnce(`Can't access cssRules, likely due to CORS restrictions: ${sheet.href}`);
    } else {
      console.error(e, sheet.href);
    }
    return false;
  }
};

const rewriteRuleContainer = (
  ruleContainer: CSSStyleSheet | CSSGroupingRule,
  rewriteLimit: number,
  forShadowDOM: boolean
): number => {
  let count = 0;
  let index = -1;
  for (const cssRule of ruleContainer.cssRules) {
    index++;
    let numRewritten = 0;

    // @ts-expect-error We're adding this nonstandard property below
    if (cssRule.__processed) {
      // @ts-expect-error We're adding this nonstandard property below
      numRewritten = cssRule.__pseudoStatesRewrittenCount;
    } else {
      let styleRules = [cssRule as CSSStyleRule];

      // Modify the rule, if it contains a pseudo state
      if ('selectorText' in styleRules[0]) {
        const newRules = rewriteRules(styleRules[0], forShadowDOM);
        if (newRules.length > 0) {
          styleRules = replaceRule(ruleContainer, index, newRules);
          numRewritten = 1;
        }
      }

      const rewrittenCounts = styleRules.map((_, styleRuleIndex) =>
        styleRuleIndex === 0 ? numRewritten : 0
      );
      styleRules.forEach((styleRule, styleRuleIndex) => {
        // If it has nested rules, check them as well
        const remainingRewriteLimit =
          rewriteLimit - count - rewrittenCounts.reduce((sum, value) => sum + value, 0);
        if (
          remainingRewriteLimit > 0 &&
          'cssRules' in styleRule &&
          (styleRule.cssRules as CSSRuleList).length
        ) {
          rewrittenCounts[styleRuleIndex] += rewriteRuleContainer(
            styleRule as CSSGroupingRule,
            remainingRewriteLimit,
            forShadowDOM
          );
        }

        // @ts-expect-error We're adding this nonstandard property
        styleRule.__processed = true;
      });
      numRewritten = rewrittenCounts.reduce((sum, value) => sum + value, 0);
      styleRules.forEach((styleRule, styleRuleIndex) => {
        // Store the total on the first rule so split replacements aren't counted again as the
        // live CSSRuleList iterator advances through them.
        // @ts-expect-error We're adding this nonstandard property
        styleRule.__pseudoStatesRewrittenCount = styleRuleIndex === 0 ? numRewritten : 0;
      });
    }
    count += numRewritten;

    if (count >= rewriteLimit) {
      break;
    }
  }

  return count;
};
