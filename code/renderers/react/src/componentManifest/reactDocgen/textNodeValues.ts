import type { SBOtherType, SBType } from 'storybook/internal/csf';

/**
 * Node type values that are string-safe: any string is a valid value for them, so they can
 * be edited with the text control (#11429). Element-ish types (ReactElement, ComponentType,
 * JSX.Element) and node arrays are deliberately excluded — a string is not assignable to
 * those, so they keep the object editor until JSX editing lands (#11428).
 *
 * This is a leaf module with no Node.js imports so the client bundle can reach it;
 * `utils.ts` next door bundles server-only docgen machinery.
 */
const REACT_TEXT_NODE_VALUES = new Set([
  'node', // PropTypes.node (react-docgen)
  'ReactNode', // react-docgen-typescript: React.ReactNode / ReactNode
  'React.ReactNode', // fully-qualified spelling from other docgen producers
  'ReactReactNode', // babel-plugin-react-docgen concatenation of React + ReactNode
]);

/** Check if an extracted SBType is a string-safe node type that should use the text control. */
export function isTextNodeValue(sbType: SBType | undefined): sbType is SBOtherType {
  return sbType?.name === 'other' && REACT_TEXT_NODE_VALUES.has(sbType.value);
}
