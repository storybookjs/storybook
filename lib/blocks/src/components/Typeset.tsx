import type { FC } from 'react';
import React from 'react';

import { withReset } from 'storybook/internal/components';
import { styled } from 'storybook/internal/theming';

import { transparentize } from 'polished';

import { getBlockBackgroundStyle } from './BlockBackgroundStyles';

const Label = styled.div(({ theme }) => ({
  marginRight: 30,
  fontSize: `${theme.typography.size.s1}px`,
  color:
    theme.base === 'light'
      ? transparentize(0.4, theme.color.defaultText)
      : transparentize(0.6, theme.color.defaultText),
}));

const Sample = styled.div({
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
});

const TypeSpecimen = styled.div({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'baseline',
  '&:not(:last-child)': { marginBottom: '1rem' },
});

const Wrapper = styled.div(withReset, ({ theme }) => ({
  ...getBlockBackgroundStyle(theme),
  margin: '25px 0 40px',
  padding: '30px 20px',
}));

export interface TypesetProps {
  fontFamily?: string;
  fontSizes: (string | number)[];
  fontWeight?: number;
  sampleText?: string;
}

/**
 * Convenient styleguide documentation showing examples of type with different sizes and weights and
 * configurable sample text.
 */
export const Typeset: FC<TypesetProps> = ({
  fontFamily,
  fontSizes,
  fontWeight,
  sampleText,
  ...props
}) => (
  <Wrapper {...props} className="docblock-typeset sb-unstyled">
    {fontSizes.map((size) => (
      <TypeSpecimen key={size}>
        <Label>{size}</Label>
        <Sample
          style={{
            fontFamily,
            fontSize: size,
            fontWeight,
            lineHeight: 1.2,
          }}
        >
          {sampleText || 'Was he a beast if music could move him so?'}
        </Sample>
      </TypeSpecimen>
    ))}
  </Wrapper>
);
