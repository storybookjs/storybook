import {
  EXCLUDED_PSEUDO_ELEMENT_PATTERNS,
  EXCLUDED_PSEUDO_ESCAPE_SEQUENCE,
  PSEUDO_STATES,
} from '../constants.ts';
import { splitSelectors } from './splitSelectors.ts';

const pseudoStates = Object.values(PSEUDO_STATES);
const pseudoStatesPattern = `${EXCLUDED_PSEUDO_ESCAPE_SEQUENCE}:(${pseudoStates.join('|')})`;
const matchOne = new RegExp(pseudoStatesPattern);
const matchAll = new RegExp(pseudoStatesPattern, 'g');

const getZeroSpecificityIndexes = (selector: string) => {
  const indexes = new Set<number>();
  const zeroSpecificityStack: boolean[] = [];
  let quote: '"' | "'" | undefined;

  for (let index = 0; index < selector.length; index++) {
    const character = selector[index];

    if (character === '\\') {
      index++;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '(') {
      const parentHasZeroSpecificity = zeroSpecificityStack.at(-1) ?? false;
      zeroSpecificityStack.push(
        parentHasZeroSpecificity || selector.slice(0, index).endsWith(':where')
      );
      continue;
    }
    if (character === ')') {
      zeroSpecificityStack.pop();
      continue;
    }
    if (zeroSpecificityStack.at(-1)) {
      indexes.add(index);
    }
  }

  return indexes;
};

const warnings = new Set();
const warnOnce = (message: string) => {
  if (warnings.has(message)) {
    return;
  }

  console.warn(message);
  warnings.add(message);
};

const replacePseudoStates = (selector: string, allClass?: boolean) => {
  const negativeLookbehind = `(?<!(?:${EXCLUDED_PSEUDO_ELEMENT_PATTERNS.join('|')})\\S*)`;
  return pseudoStates.reduce(
    (acc, state) =>
      acc.replace(
        new RegExp(`${negativeLookbehind}${EXCLUDED_PSEUDO_ESCAPE_SEQUENCE}:${state}`, 'g'),
        `.pseudo-${state}${allClass ? '-all' : ''}`
      ),
    selector
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

  const selectors = `${additionalHostSelectors ?? ''}${extracted.states
    .filter((state) => !extracted.zeroSpecificityStates.includes(state))
    .map((state) => `.pseudo-${state}-all`)
    .join('')}${
    extracted.zeroSpecificityStates.length > 0
      ? `:where(${extracted.zeroSpecificityStates.map((state) => `.pseudo-${state}-all`).join('')})`
      : ''
  }`;

  // If there was a :host-context() containing only pseudo-states, we will later add a :host selector that replaces it.
  let { withoutPseudoStates } = extracted;
  withoutPseudoStates = withoutPseudoStates.replace(':host-context(*)', '').trimStart();

  // If there is a :host-context() selector, we don't need to introduce a :host() selector.
  // We can just append the pseudo-state classes to the :host-context() selector.
  return withoutPseudoStates.startsWith(':host-context(')
    ? withoutPseudoStates.replace(/(?<=:host-context\(\S+)\)/, `)${selectors}`)
    : forShadowDOM
      ? `:host(${selectors}) ${withoutPseudoStates}`
      : `${selectors} ${withoutPseudoStates}`;
};

const extractPseudoStates = (selector: string) => {
  const states = new Set<string>();
  const statesWithSpecificity = new Set<string>();
  const zeroSpecificityIndexes = getZeroSpecificityIndexes(selector);
  const withoutPseudoStates =
    selector
      .replace(matchAll, (_, state: string, index: number) => {
        states.add(state);
        if (!zeroSpecificityIndexes.has(index)) {
          statesWithSpecificity.add(state);
        }
        return '';
      })
      // If removing pseudo-state selectors from inside a functional selector left it empty (thus invalid), must fix it by adding '*'.
      // The negative lookbehind ensures we don't replace :is() with :is(*).
      .replaceAll(/(?<!is)\(\)/g, '(*)')
      // If removing pseudo-state selectors left a combinator without a right-hand selector,
      // keep the selector valid by targeting any child/sibling.
      .replace(/([>+~])\s*(?=$|[,)])/g, '$1 *')
      // If a selector list was left with blank items (e.g. ", foo, , bar, "), remove the extra commas/spaces.
      .replace(/(?<=[\s(]),\s+|(,\s+)+(?=\))/g, '')
      // A :where() containing only pseudo-states no longer constrains the target element.
      .replaceAll(':where(*)', '') || '*';

  return {
    states: Array.from(states),
    zeroSpecificityStates: Array.from(states).filter((state) => !statesWithSpecificity.has(state)),
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

const rewriteRule = ({ cssText, selectorText }: CSSStyleRule, forShadowDOM: boolean) => {
  return cssText.replace(
    selectorText,
    splitSelectors(selectorText)
      .flatMap((selector) => {
        if (selector.includes('.pseudo-')) {
          return [];
        }
        const replacementSelectors = [selector];
        if (!matchOne.test(selector)) {
          return replacementSelectors;
        }

        const classSelector = replacePseudoStates(selector);
        if (classSelector !== selector) {
          replacementSelectors.push(classSelector);
        }

        let ancestorSelector = '';

        if (selector.startsWith(':host(')) {
          const matches = selector.match(/^:host\((\S+)\)\s+(.+)$/);
          if (matches && matchOne.test(matches[2])) {
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
          ancestorSelector = replacePseudoStatesWithAncestorSelector(
            withNotsReplaced,
            forShadowDOM
          );
        }
        replacementSelectors.push(ancestorSelector);

        return replacementSelectors;
      })
      .join(', ')
  );
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
      let styleRule = cssRule as CSSStyleRule;

      // Modify the rule, if it contains a pseudo state
      if ('selectorText' in styleRule) {
        if (matchOne.test(styleRule.selectorText)) {
          const newRule = rewriteRule(styleRule, forShadowDOM);
          ruleContainer.deleteRule(index);
          ruleContainer.insertRule(newRule, index);
          styleRule = ruleContainer.cssRules[index] as CSSStyleRule;
          numRewritten = 1;
        }
      }

      // If it has nested rules, check them as well
      if ('cssRules' in styleRule && (styleRule.cssRules as CSSRuleList).length) {
        numRewritten = rewriteRuleContainer(
          styleRule as CSSGroupingRule,
          rewriteLimit - count,
          forShadowDOM
        );
      }

      // @ts-expect-error We're adding this nonstandard property
      cssRule.__processed = true;
      // @ts-expect-error We're adding this nonstandard property
      cssRule.__pseudoStatesRewrittenCount = numRewritten;
    }
    count += numRewritten;

    if (count >= rewriteLimit) {
      break;
    }
  }

  return count;
};
