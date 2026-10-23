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

const findSelectorLiteralRanges = (selector: string) => {
  const ranges: IndexRange[] = [];
  let start = 0;
  let brackets = 0;
  let quote = '';

  for (let index = 0; index < selector.length; index++) {
    if (isEscaped(selector, index)) {
      continue;
    }
    const character = selector[index];
    if (quote) {
      if (character === quote) {
        quote = '';
        if (brackets === 0) {
          ranges.push({ start, end: index + 1 });
        }
      }
    } else if (character === '"' || character === "'") {
      if (brackets === 0) {
        start = index;
      }
      quote = character;
    } else if (character === '[') {
      if (brackets++ === 0) {
        start = index;
      }
    } else if (character === ']' && brackets > 0 && --brackets === 0) {
      ranges.push({ start, end: index + 1 });
    }
  }

  return ranges;
};

const findFunctionalSelectorRanges = (
  selector: string,
  name: string,
  literalRanges: IndexRange[]
) => {
  const ranges: IndexRange[] = [];
  const opening = `:${name}(`;
  let start = selector.indexOf(opening);

  while (start !== -1) {
    let end = start + opening.length;
    if (
      !isEscaped(selector, start) &&
      !literalRanges.some((range) => start >= range.start && start < range.end)
    ) {
      let depth = 1;
      for (; end < selector.length; end++) {
        if (
          isEscaped(selector, end) ||
          literalRanges.some((range) => end >= range.start && end < range.end)
        ) {
          continue;
        }
        if (selector[end] === '(') {
          depth++;
        } else if (selector[end] === ')' && --depth === 0) {
          ranges.push({ start, end: ++end });
          break;
        }
      }
    }
    start = selector.indexOf(opening, end);
  }

  return ranges;
};

const findPseudoStates = (selector: string) => {
  const matches: PseudoStateMatch[] = [];
  const literalRanges = findSelectorLiteralRanges(selector);
  pseudoStatePattern.lastIndex = 0;

  let match = pseudoStatePattern.exec(selector);
  while (match) {
    const index = match.index;
    if (
      !isEscaped(selector, index) &&
      !literalRanges.some(({ start, end }) => index >= start && index < end)
    ) {
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

const protectNegatedPseudoStates = (
  selector: string,
  forShadowDOM: boolean,
  pseudoForcingActive: boolean
) => {
  const negations: { placeholder: string; selector: string }[] = [];
  const literalRanges = findSelectorLiteralRanges(selector);
  const hostSelectorEnd = findFunctionalSelectorRanges(selector, 'host', literalRanges).find(
    ({ start }) => start === 0
  )?.end;
  const ranges = findFunctionalSelectorRanges(selector, 'not', literalRanges);
  let cursor = 0;
  let protectedSelector = '';
  for (const { start, end } of ranges) {
    protectedSelector += selector.slice(cursor, start);
    const negation = selector.slice(start, end);
    const matches = findPseudoStates(negation);
    cursor = end;
    if (matches.length === 0) {
      protectedSelector += negation;
      continue;
    }
    const rewritten = pseudoForcingActive
      ? replacePseudoStateMatches(negation, matches, (state) => {
          const ancestorSelector =
            hostSelectorEnd && start < hostSelectorEnd
              ? `.pseudo-${state}-all`
              : forShadowDOM
                ? `:host(.pseudo-${state}-all) *`
                : `.pseudo-${state}-all *`;
          return `:is(:${state}, .pseudo-${state}, :where(${ancestorSelector}))`;
        })
      : negation;
    let placeholder = `:not(.__storybook_negation_${negations.length})`;
    while (selector.includes(placeholder)) {
      placeholder = placeholder.replace(')', '_)');
    }
    negations.push({ placeholder, selector: rewritten });
    protectedSelector += placeholder;
  }
  protectedSelector += selector.slice(cursor);

  return {
    selector: protectedSelector,
    didRewrite: pseudoForcingActive && negations.length > 0,
    restore: (rewritten: string) =>
      negations.reduce(
        (result, negation) => result.replaceAll(negation.placeholder, negation.selector),
        rewritten
      ),
  };
};

const rewriteRules = (
  { cssText, selectorText }: CSSStyleRule,
  forShadowDOM: boolean,
  pseudoForcingActive: boolean
) => {
  let didRewrite = false;
  const rewrittenSelectors = splitSelectors(selectorText).flatMap((selector) => {
    if (selector.includes('.pseudo-')) {
      return [selector];
    }
    const negations = protectNegatedPseudoStates(selector, forShadowDOM, pseudoForcingActive);
    selector = negations.selector;
    const replacementSelectors = [selector];
    const pseudoStateMatches = findPseudoStates(selector);
    if (pseudoStateMatches.length === 0) {
      didRewrite ||= negations.didRewrite;
      return replacementSelectors.map(negations.restore);
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
        const descendantSelector = matches[2];
        hostInnerSelector = replacePseudoStates(hostInnerSelector, true);
        // Any remaining pseudo-states in the descendant selector need to be moved into the host selector.
        ancestorSelector = replacePseudoStatesWithAncestorSelector(
          descendantSelector,
          true,
          hostInnerSelector
        );
      } else {
        ancestorSelector = replacePseudoStates(selector, true);
      }
    } else {
      ancestorSelector = replacePseudoStatesWithAncestorSelector(selector, forShadowDOM);
    }
    replacementSelectors.push(ancestorSelector);

    return replacementSelectors.map(negations.restore);
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

type RewrittenRule = {
  container: CSSStyleSheet | CSSGroupingRule;
  originalSelector: string;
  rules: CSSStyleRule[];
};

const sheetStates = new WeakMap<
  CSSStyleSheet,
  { forcingActive: boolean; rewrittenRules: RewrittenRule[] }
>();

const clearProcessedRules = (container: CSSStyleSheet | CSSGroupingRule) => {
  for (const rule of container.cssRules) {
    const processed = rule as CSSRule & {
      __processed?: boolean;
      __pseudoStatesRewrittenCount?: number;
    };
    delete processed.__processed;
    delete processed.__pseudoStatesRewrittenCount;
    if ('cssRules' in rule) {
      clearProcessedRules(rule as CSSGroupingRule);
    }
  }
};

export const rewriteStyleSheet = (
  sheet: CSSStyleSheet,
  forShadowDOM = false,
  pseudoForcingActive = false
): boolean => {
  try {
    let state = sheetStates.get(sheet);
    if (state && state.forcingActive !== pseudoForcingActive) {
      for (const { container, originalSelector, rules } of [...state.rewrittenRules].reverse()) {
        const index = Array.from(container.cssRules).indexOf(rules[0]);
        if (
          index !== -1 &&
          rules.every((rule, offset) => container.cssRules[index + offset] === rule)
        ) {
          const restored = rules[0].cssText.replace(rules[0].selectorText, () => originalSelector);
          container.insertRule(restored, index);
          rules.forEach(() => container.deleteRule(index + 1));
        }
      }
      clearProcessedRules(sheet);
      state = undefined;
    }
    if (!state) {
      state = { forcingActive: pseudoForcingActive, rewrittenRules: [] };
      sheetStates.set(sheet, state);
    }
    const maximumRulesToRewrite = 1000;
    const count = rewriteRuleContainer(
      sheet,
      maximumRulesToRewrite,
      forShadowDOM,
      pseudoForcingActive,
      state.rewrittenRules
    );

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
  forShadowDOM: boolean,
  pseudoForcingActive: boolean,
  rewrittenRules: RewrittenRule[]
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
        const newRules = rewriteRules(styleRules[0], forShadowDOM, pseudoForcingActive);
        if (newRules.length > 0) {
          const originalSelector = styleRules[0].selectorText;
          styleRules = replaceRule(ruleContainer, index, newRules);
          rewrittenRules.push({ container: ruleContainer, originalSelector, rules: styleRules });
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
            forShadowDOM,
            pseudoForcingActive,
            rewrittenRules
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
