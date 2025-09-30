import type { FC, PropsWithChildren, ReactChild, ReactElement, ReactNode } from 'react';
import React, { Children } from 'react';

import { deprecate } from 'storybook/internal/client-logger';
import type { Addon_RenderOptions } from 'storybook/internal/types';

import { styled } from 'storybook/theming';

import type { TabsProps } from './Tabs';

export interface VisuallyHiddenProps {
  active?: boolean;
}

export const VisuallyHidden = styled.div<VisuallyHiddenProps>(({ active }) =>
  active ? { display: 'block' } : { display: 'none' }
);

export const childrenToList = (children: TabsProps['children']) => {
  deprecate('The `childrenToList` tabs helper is deprecated. Use `TabsView` instead.');
  return Children.toArray(children).map(
    // @ts-expect-error (non strict)
    ({
      props: { title, id, color, children: childrenOfChild },
    }: ReactElement<{
      children: FC<Addon_RenderOptions & PropsWithChildren> | ReactChild | null;
      title: ReactChild | null | FC;
      id: string;
      color?: string;
    }>) => {
      const content: FC<Addon_RenderOptions & PropsWithChildren> | ReactNode = Array.isArray(
        childrenOfChild
      )
        ? childrenOfChild[0]
        : childrenOfChild;

      const render: FC<Addon_RenderOptions & PropsWithChildren> = (
        typeof content === 'function'
          ? content
          : ({ active }) => (
              <VisuallyHidden active={active} role="tabpanel">
                {content}
              </VisuallyHidden>
            )
      ) as FC<Addon_RenderOptions & PropsWithChildren>;
      return {
        title,
        id,
        ...(color ? { color } : {}),
        render,
      };
    }
  );
};

export type ChildrenList = ReturnType<typeof childrenToList>;
export type ChildrenListComplete = Array<
  ReturnType<typeof childrenToList>[0] & {
    active: boolean;
  }
>;
