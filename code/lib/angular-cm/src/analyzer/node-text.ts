import type * as tsModule from 'typescript';
import type { DocgenTypeScript } from '@storybook/component-meta-typescript';

export const memberName = (ts: DocgenTypeScript, name: tsModule.PropertyName): string =>
  ts.isComputedPropertyName(name) ? name.getText() : name.text;

// TypeScript 7.1's native nodes carry a class member's `?` as `postfixToken` (`?` or `!`).
export const isOptionalMember = (
  ts: DocgenTypeScript,
  member: tsModule.ClassElement | tsModule.TypeElement
): boolean =>
  ('questionToken' in member && member.questionToken !== undefined) ||
  (member as { postfixToken?: tsModule.Node }).postfixToken?.kind === ts.SyntaxKind.QuestionToken;
