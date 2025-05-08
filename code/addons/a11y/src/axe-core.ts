/**
 * We re-export axe-core to avoid having it bundled in twice into the `preview.ts` and `index.ts`
 * entrypoints.
 *
 * When using the runtime of `axe-core` you should import it via:
 *
 * ```ts
 * import axe from '@storybook/addon-a11y/axe-core';
 * ```
 *
 * When importing the types of `axe-core` you should import as such:
 *
 * ```ts
 * import type { AxeResults } from 'axe-core';
 * ```
 *
 * This is because `axe-core`'s types are externalized, due to the fact they use typescript
 * `namespace` declarations; which cannot be bundled by our type-bundler.
 *
 * The list of type-exports is manually maintained and should be kept in sync with
 * `code/node_modules/axe-core/axe.d.ts`.
 */
import axe from 'axe-core';

export type {
  ImpactValue,
  TagValue,
  ReporterVersion,
  RunOnlyType,
  resultGroups,
  AriaAttrsType,
  AriaRolesType,
  DpubRolesType,
  HtmlContentTypes,
  MultiArray,
  BaseSelector,
  ShadowDomSelector,
  CrossTreeSelector,
  LabelledShadowDomSelector,
  FramesSelector,
  UnlabelledFrameSelector,
  LabelledFramesSelector,
  CrossFrameSelector,
  Selector,
  SelectorList,
  ContextProp,
  ContextObject,
  ContextSpec,
  ElementContext,
  SerialSelector,
  SerialFrameSelector,
  SerialSelectorList,
  SerialContextObject,
  FrameContextObject,
  RunCallback,
  TestEngine,
  TestRunner,
  TestEnvironment,
  RunOnly,
  RuleObject,
  RunOptions,
  PreloadOptions,
  AxeResults,
  Result,
  NodeResult,
  CheckResult,
  RelatedNode,
  RuleLocale,
  CheckMessages,
  CheckLocale,
  Locale,
  AriaAttrs,
  AriaRoles,
  HtmlElmsVariant,
  HtmlElms,
  Standards,
  Spec,
  Branding,
  CheckHelper,
  AfterResult,
  Check,
  Rule,
  AxePlugin,
  RuleMetadata,
  SerialDqElement,
  DqElement,
  PartialRuleResult,
  PartialResult,
  PartialResults,
  FrameContext,
  RawCheckResult,
  RawNodeResult,
  RawResult,
  AxeReporter,
  VirtualNode,
  Utils,
  Aria,
  Dom,
  AccessibleTextOptions,
  Text,
  Commons,
  EnvironmentData,
  FrameMessenger,
  Close,
  TopicHandler,
  ReplyHandler,
  Responder,
  TopicData,
  ReplyData,
} from 'axe-core';

export default axe;
