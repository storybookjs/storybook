import React, { Suspense, lazy } from 'react';
import type { ComponentProps } from 'react';

import type ReactSyntaxHighlighter from './syntaxhighlighter.tsx';

let languages: Parameters<typeof ReactSyntaxHighlighter.registerLanguage>[] = [];
let Comp: typeof ReactSyntaxHighlighter | null = null;

const LazySyntaxHighlighter = lazy(async () => {
  const { SyntaxHighlighter } = await import('./syntaxhighlighter.tsx');

  if (languages.length > 0) {
    languages.forEach((args) => {
      SyntaxHighlighter.registerLanguage(...args);
    });
    languages = [];
  }

  if (Comp === null) {
    Comp = SyntaxHighlighter;
  }

  return {
    default: (props: ComponentProps<typeof SyntaxHighlighter>) => <SyntaxHighlighter {...props} />,
  };
});

const LazySyntaxHighlighterWithFormatter = lazy(async () => {
  const [{ SyntaxHighlighter }, { formatter }] = await Promise.all([
    import('./syntaxhighlighter.tsx'),
    import('./formatter.ts'),
  ]);

  if (languages.length > 0) {
    languages.forEach((args) => {
      SyntaxHighlighter.registerLanguage(...args);
    });
    languages = [];
  }

  if (Comp === null) {
    Comp = SyntaxHighlighter;
  }

  return {
    default: (props: ComponentProps<typeof SyntaxHighlighter>) => (
      <SyntaxHighlighter {...props} formatter={formatter} />
    ),
  };
});

export const SyntaxHighlighter = (
  props:
    | ComponentProps<typeof LazySyntaxHighlighter>
    | ComponentProps<typeof LazySyntaxHighlighterWithFormatter>
) => (
  <Suspense fallback={<div />}>
    {props.format !== false ? (
      <LazySyntaxHighlighterWithFormatter {...props} />
    ) : (
      <LazySyntaxHighlighter {...props} />
    )}
  </Suspense>
);

SyntaxHighlighter.registerLanguage = (
  ...args: Parameters<typeof ReactSyntaxHighlighter.registerLanguage>
) => {
  if (Comp !== null) {
    Comp.registerLanguage(...args);
    return;
  }
  languages.push(args);
};
