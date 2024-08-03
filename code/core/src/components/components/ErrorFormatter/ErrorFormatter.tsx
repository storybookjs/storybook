import { global } from '@storybook/global';

import React, { Fragment } from 'react';
import { styled } from '@storybook/core/theming';

const { document } = global;

const ErrorName = styled.strong(({ theme }) => ({
  color: theme.color.orange,
}));
const ErrorImportant = styled.strong(({ theme }) => ({
  color: theme.color.ancillary,
  textDecoration: 'underline',
}));
const ErrorDetail = styled.em(({ theme }) => ({
  color: theme.textMutedColor,
}));

const firstLineRegex = /(Error): (.*)\n/;
const linesRegexChromium = /at (?:(.*) )?\(?(.+)\)?/;
const linesRegexFirefox = /([^@]+)?(?:\/<)?@(.+)?/;
const linesRegexSafari = /([^@]+)?@(.+)?/;

export interface ErrorFormatterProps {
  error: Error;
}

export const ErrorFormatter = ({ error }: ErrorFormatterProps) => {
  if (!error) {
    return <Fragment>This error has no stack or message</Fragment>;
  }
  if (!error.stack) {
    return <Fragment>{error.message || 'This error has no stack or message'}</Fragment>;
  }

  let input = error.stack.toString();

  if (input && error.message && !input.includes(error.message)) {
    input = `Error: ${error.message}\n\n${input}`;
  }

  const match = input.match(firstLineRegex);

  if (!match) {
    return <Fragment>{input}</Fragment>;
  }

  const [, type, name] = match;

  const rawLines = input.split(/\n/).slice(1);
  const [, ...lines] = rawLines
    .map((line) => {
      const result =
        line.match(linesRegexChromium) ||
        line.match(linesRegexFirefox) ||
        line.match(linesRegexSafari);
      if (result) {
        return {
          name: (result[1] || '').replace('/<', ''),
          location: result[2].replace(document.location.origin, ''),
        };
      }

      return null;
    })
    .filter(Boolean);

  return (
    <Fragment>
      <span>{type}</span>: <ErrorName>{name}</ErrorName>
      <br />
      {lines.map((l, i) =>
        l?.name ? (
          <Fragment key={i}>
            {'  '}at <ErrorImportant>{l.name}</ErrorImportant> (
            <ErrorDetail>{l.location}</ErrorDetail>)
            <br />
          </Fragment>
        ) : (
          <Fragment key={i}>
            {'  '}at <ErrorDetail>{l?.location}</ErrorDetail>
            <br />
          </Fragment>
        )
      )}
    </Fragment>
  );
};
