import {
  EXCLUDED_PSEUDO_ELEMENT_PATTERNS,
  EXCLUDED_PSEUDO_ESCAPE_SEQUENCE,
  PSEUDO_STATES,
} from '../constants';
import { splitSelectors } from './splitSelectors';

const pseudoStates = Object.values(PSEUDO_STATES);
const pseudoStatesPattern = `${EXCLUDED_PSEUDO_ESCAPE_SEQUENCE}:(${pseudoStates.join('|')})`;
const matchOne = new RegExp(pseudoStatesPattern);
const matchAll = new RegExp(pseudoStatesPattern, 'g');
/**
 * Checks if a CSSMediaRule is a hover capability media query like `@media (hover: hover)`.
 * Tailwind CSS v4 wraps hover styles in this media query to only apply on hover-capable devices.
 * This causes issues with pseudo-state simulation since the media query won't match during testing.
 */
const isHoverMediaRule = (rule: CSSRule): rule is CSSMediaRule => {
  if (rule.type !== CSSRule.MEDIA_RULE) {
    return false;
  }
  const mediaRule = rule as CSSMediaRule;
  // Match various forms of hover media queries:
  // @media (hover: hover)
  // @media (hover)
  // @media (any-hover: hover)
  // Also handle combined queries like @media (hover: hover) and (pointer: fine)
  const mediaText = mediaRule.conditionText || mediaRule.media.mediaText;
  return /\(\s*(any-)?hover\s*(:\s*hover\s*)?\)/.test(mediaText);
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

  const selectors = `${additionalHostSelectors ?? ''}${extracted.states.map((s) => `.pseudo-${s}-all`).join('')}`;

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
  const states = new Set();
  const withoutPseudoStates =
    selector
      .replace(matchAll, (_, state) => {
        states.add(state);
        return '';
      })
      // If removing pseudo-state selectors from inside a functional selector left it empty (thus invalid), must fix it by adding '*'.
      // The negative lookbehind ensures we don't replace :is() with :is(*).
      .replaceAll(/(?<!is)\(\)/g, '(*)')
      // If a selector list was left with blank items (e.g. ", foo, , bar, "), remove the extra commas/spaces.
      .replace(/(?<=[\s(]),\s+|(,\s+)+(?=\))/g, '') || '*';

  return {
    states: Array.from(states),
    withoutPseudoStates,
  };
};

const rewriteNotSelectors = (selector: string, forShadowDOM: boolean) => {
  return [...selector.matchAll(/:not\(([^)]+)\)/g)].reduce((acc, match) => {
    const originalNot = match[0];
    const selectorList = match[1];
    const rewrittenNot = rewriteNotSelector(selectorList, forShadowDOM);
    return acc.replace(originalNot, rewrittenNot);
  }, selector);
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


/**
 * Generates pseudo-state only selectors for a rule (without the original pseudo-class selectors).
 * Used for extracting rules from @media (hover: hover) blocks to work outside the media query.
 */
const generatePseudoStateOnlyRule = (
  { cssText, selectorText }: CSSStyleRule,
  forShadowDOM: boolean
): string | null => {
  const pseudoStateSelectors = splitSelectors(selectorText)
    .flatMap((selector) => {
      if (selector.includes('.pseudo-') || !matchOne.test(selector)) {
        return [];
      }

      const result: string[] = [];

      const classSelector = replacePseudoStates(selector);
      if (classSelector !== selector) {
        result.push(classSelector);
      }

      let ancestorSelector = '';

      if (selector.startsWith(':host(')) {
        const matches = selector.match(/^:host\((\S+)\)\s+(.+)$/);
        if (matches && matchOne.test(matches[2])) {
          let hostInnerSelector = matches[1];
          let descendantSelector = matches[2];
          hostInnerSelector = replacePseudoStates(hostInnerSelector, true);
          descendantSelector = rewriteNotSelectors(descendantSelector, true);
          ancestorSelector = replacePseudoStatesWithAncestorSelector(
            descendantSelector,
            true,
            hostInnerSelector
          );
        } else {
          ancestorSelector = replacePseudoStates(selector, true);
        }
      } else {
        const withNotsReplaced = rewriteNotSelectors(selector, forShadowDOM);
        ancestorSelector = replacePseudoStatesWithAncestorSelector(withNotsReplaced, forShadowDOM);
      }
      result.push(ancestorSelector);

      return result;
    })
    .filter(Boolean);

  if (pseudoStateSelectors.length === 0) {
    return null;
  }

  return cssText.replace(selectorText, pseudoStateSelectors.join(', '));
};

// Track inserted rules per stylesheet to prevent duplicate insertion across multiple rewriteStyleSheet calls
const insertedRulesCache = new WeakMap<CSSStyleSheet, Set<string>>();

// Rewrites the style sheet to add alternative selectors for any rule that targets a pseudo state.
// A sheet can only be rewritten once, and may carry over between stories.
export const rewriteStyleSheet = (sheet: CSSStyleSheet, forShadowDOM = false): boolean => {
  try {
    // Get or create the set of inserted rules for this stylesheet
    if (!insertedRulesCache.has(sheet)) {
      insertedRulesCache.set(sheet, new Set<string>());
    }
    const insertedRules = insertedRulesCache.get(sheet)!;

    const maximumRulesToRewrite = 1000;
    const count = rewriteRuleContainer(sheet, maximumRulesToRewrite, forShadowDOM, sheet, insertedRules);

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
  rootSheet: CSSStyleSheet,
  insertedRules: Set<string>
): number => {
  let count = 0;
  let index = -1;
  // Collect rules to add at root level (for hover media query extraction)
  const rulesToAddAtRoot: string[] = [];

  for (const cssRule of ruleContainer.cssRules) {
    index++;
    let numRewritten = 0;

    // @ts-expect-error We're adding this nonstandard property below
    if (cssRule.__processed) {
      // @ts-expect-error We're adding this nonstandard property below
      numRewritten = cssRule.__pseudoStatesRewrittenCount;
    } else {
      if ('cssRules' in cssRule && (cssRule.cssRules as CSSRuleList).length) {
        // Check if this is a @media (hover: hover) rule (Tailwind CSS v4 pattern)
        // If so, we need to extract pseudo-state rules and add them outside the media query
        if (isHoverMediaRule(cssRule)) {
          const extractedRules = extractPseudoStateRulesFromHoverMedia(
            cssRule as CSSGroupingRule,
            forShadowDOM
          );
          rulesToAddAtRoot.push(...extractedRules);
        }

        numRewritten = rewriteRuleContainer(
          cssRule as CSSGroupingRule,
          rewriteLimit - count,
          forShadowDOM,
          rootSheet,
          insertedRules
        );
      } else {
        if (!('selectorText' in cssRule)) {
          continue;
        }
        const styleRule = cssRule as CSSStyleRule;
        if (matchOne.test(styleRule.selectorText)) {
          const newRule = rewriteRule(styleRule, forShadowDOM);
          ruleContainer.deleteRule(index);
          ruleContainer.insertRule(newRule, index);
          numRewritten = 1;
        }
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

  // Add extracted hover media rules at the root stylesheet level
  // This ensures pseudo-state selectors work even when @media (hover: hover) doesn't match
  for (const rule of rulesToAddAtRoot) {
    // Skip if this rule has already been inserted (prevents duplicates on subsequent rewrites)
    if (insertedRules.has(rule)) {
      continue;
    }

    try {
      const insertedIndex = rootSheet.insertRule(rule, rootSheet.cssRules.length);
      // Track this rule to prevent duplicate insertion
      insertedRules.add(rule);
      // Mark the inserted rule as processed to prevent re-processing
      // @ts-expect-error Adding custom property to track processed rules
      rootSheet.cssRules[insertedIndex].__processed = true;
      // @ts-expect-error Adding custom property to track rewrite count
      rootSheet.cssRules[insertedIndex].__pseudoStatesRewrittenCount = 0;
    } catch (e) {
      // Rule insertion can fail for various reasons (invalid syntax, etc.)
      // Log in development to help troubleshoot, silently ignore in production
      if (process.env.NODE_ENV === 'development') {
        console.debug('[pseudo-states] Failed to insert rule:', rule, e);
      }
    }
  }

  return count;
};
/**
 * Extracts pseudo-state rules from a @media (hover: hover) block.
 * These rules are returned so they can be added at the root stylesheet level,
 * ensuring they apply even when the hover media query doesn't match.
 */
const extractPseudoStateRulesFromHoverMedia = (
  groupingRule: CSSGroupingRule,
  forShadowDOM: boolean
): string[] => {
  const extractedRules: string[] = [];

  for (const cssRule of groupingRule.cssRules) {
    // Recursively process nested grouping rules (e.g., @layer inside @media)
    if ('cssRules' in cssRule && (cssRule.cssRules as CSSRuleList).length) {
      const nestedRules = extractPseudoStateRulesFromHoverMedia(
        cssRule as CSSGroupingRule,
        forShadowDOM
      );
      extractedRules.push(...nestedRules);
    } else if ('selectorText' in cssRule) {
      const styleRule = cssRule as CSSStyleRule;
      if (matchOne.test(styleRule.selectorText)) {
        const pseudoStateRule = generatePseudoStateOnlyRule(styleRule, forShadowDOM);
        if (pseudoStateRule) {
          extractedRules.push(pseudoStateRule);
        }
      }
    }
  }

  return extractedRules;
};

