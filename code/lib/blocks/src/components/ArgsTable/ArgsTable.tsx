import type { FC } from 'react';
import React from 'react';

import { once } from 'storybook/internal/client-logger';
import { IconButton, Link, ResetWrapper } from 'storybook/internal/components';
import { styled, transparentize } from 'storybook/internal/theming';

import { includeConditionalArg } from '@storybook/csf';
import { DocumentIcon, UndoIcon } from '@storybook/icons';

import pickBy from 'lodash/pickBy.js';

import { EmptyBlock } from '..';
import { ArgRow } from './ArgRow';
import { Empty } from './Empty';
import { SectionRow } from './SectionRow';
import { Skeleton } from './Skeleton';
import type { ArgType, ArgTypes, Args, Globals } from './types';

export const TableWrapper = styled.table<{
  compact?: boolean;
  inAddonPanel?: boolean;
  isLoading?: boolean;
}>(({ theme, compact, inAddonPanel }) => ({
  '&&': {
    // Resets for cascading/system styles
    borderSpacing: 0,
    color: theme.color.defaultText,

    'td, th': {
      padding: 0,
      border: 'none',
      verticalAlign: 'top',
      textOverflow: 'ellipsis',
    },
    // End Resets

    fontSize: theme.typography.size.s2 - 1,
    lineHeight: '20px',
    textAlign: 'left',
    width: '100%',

    // Margin collapse
    marginTop: inAddonPanel ? 0 : 25,
    marginBottom: inAddonPanel ? 0 : 40,

    'thead th:first-of-type, td:first-of-type': {
      // intentionally specify thead here
      width: '25%',
    },

    'th:first-of-type, td:first-of-type': {
      paddingLeft: 20,
    },

    'th:nth-of-type(2), td:nth-of-type(2)': {
      ...(compact
        ? null
        : {
            // Description column
            width: '35%',
          }),
    },

    'td:nth-of-type(3)': {
      ...(compact
        ? null
        : {
            // Defaults column
            width: '15%',
          }),
    },

    'th:last-of-type, td:last-of-type': {
      paddingRight: 20,
      ...(compact
        ? null
        : {
            // Controls column
            width: '25%',
          }),
    },

    th: {
      color:
        theme.base === 'light'
          ? transparentize(0.25, theme.color.defaultText)
          : transparentize(0.45, theme.color.defaultText),
      paddingTop: 10,
      paddingBottom: 10,
      paddingLeft: 15,
      paddingRight: 15,
    },

    td: {
      paddingTop: '10px',
      paddingBottom: '10px',

      '&:not(:first-of-type)': {
        paddingLeft: 15,
        paddingRight: 15,
      },

      '&:last-of-type': {
        paddingRight: 20,
      },
    },

    // Makes border alignment consistent w/other DocBlocks
    marginLeft: inAddonPanel ? 0 : 1,
    marginRight: inAddonPanel ? 0 : 1,

    tbody: {
      // Safari doesn't love shadows on tbody so we need to use a shadow filter. In order to do this,
      // the table cells all need to be solid so they have a background color applied.
      // I wasn't sure what kinds of content go in these tables so I was extra specific with selectors
      // to avoid unexpected surprises.
      ...(inAddonPanel
        ? null
        : {
            filter:
              theme.base === 'light'
                ? `drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.10))`
                : `drop-shadow(0px 1px 3px rgba(0, 0, 0, 0.20))`,
          }),

      '> tr > *': {
        // For filter to work properly, the table cells all need to be opaque.
        background: theme.background.content,
        borderTop: `1px solid ${theme.appBorderColor}`,
      },

      ...(inAddonPanel
        ? null
        : {
            // This works and I don't know why. :)
            '> tr:first-of-type > *': {
              borderBlockStart: `1px solid ${theme.appBorderColor}`,
            },
            '> tr:last-of-type > *': {
              borderBlockEnd: `1px solid ${theme.appBorderColor}`,
            },
            '> tr > *:first-of-type': {
              borderInlineStart: `1px solid ${theme.appBorderColor}`,
            },
            '> tr > *:last-of-type': {
              borderInlineEnd: `1px solid ${theme.appBorderColor}`,
            },

            // Thank you, Safari, for making me write code like this.
            '> tr:first-of-type > td:first-of-type': {
              borderTopLeftRadius: theme.appBorderRadius,
            },
            '> tr:first-of-type > td:last-of-type': {
              borderTopRightRadius: theme.appBorderRadius,
            },
            '> tr:last-of-type > td:first-of-type': {
              borderBottomLeftRadius: theme.appBorderRadius,
            },
            '> tr:last-of-type > td:last-of-type': {
              borderBottomRightRadius: theme.appBorderRadius,
            },
          }),
    },
    // End awesome table styling
  },
}));

const StyledIconButton = styled(IconButton as any)(({ theme }) => ({
  margin: '-4px -12px -4px 0',
}));

const ControlHeadingWrapper = styled.span({
  display: 'flex',
  justifyContent: 'space-between',
});

export enum ArgsTableError {
  NO_COMPONENT = 'No component found.',
  ARGS_UNSUPPORTED = 'Args unsupported. See Args documentation for your framework.',
}

export type SortType = 'alpha' | 'requiredFirst' | 'none';
type SortFn = (a: ArgType, b: ArgType) => number;

const sortFns: Record<SortType, SortFn | null> = {
  alpha: (a: ArgType, b: ArgType) => a.name.localeCompare(b.name),
  requiredFirst: (a: ArgType, b: ArgType) =>
    Number(!!b.type?.required) - Number(!!a.type?.required) || a.name.localeCompare(b.name),
  none: undefined,
};

export interface ArgsTableOptionProps {
  children?: React.ReactNode;
  updateArgs?: (args: Args) => void;
  resetArgs?: (argNames?: string[]) => void;
  compact?: boolean;
  inAddonPanel?: boolean;
  initialExpandedArgs?: boolean;
  isLoading?: boolean;
  sort?: SortType;
}
interface ArgsTableDataProps {
  rows: ArgTypes;
  args?: Args;
  globals?: Globals;
}

interface ArgsTableErrorProps {
  error: ArgsTableError;
}

export interface ArgsTableLoadingProps {
  isLoading: boolean;
}

export type ArgsTableProps = ArgsTableOptionProps &
  (ArgsTableDataProps | ArgsTableErrorProps | ArgsTableLoadingProps);

type Rows = ArgType[];
type Subsection = Rows;
type Section = {
  ungrouped: Rows;
  subsections: Record<string, Subsection>;
};
type Sections = {
  ungrouped: Rows;
  ungroupedSubsections: Record<string, Subsection>;
  sections: Record<string, Section>;
};

const groupRows = (rows: ArgType, sort: SortType) => {
  const sections: Sections = { ungrouped: [], ungroupedSubsections: {}, sections: {} };

  if (!rows) {
    return sections;
  }

  Object.entries(rows).forEach(([key, row]) => {
    const { category, subcategory } = row?.table || {};
    if (category) {
      const section = sections.sections[category] || { ungrouped: [], subsections: {} };
      if (!subcategory) {
        section.ungrouped.push({ key, ...row });
      } else {
        const subsection = section.subsections[subcategory] || [];
        subsection.push({ key, ...row });
        section.subsections[subcategory] = subsection;
      }
      sections.sections[category] = section;
    } else if (subcategory) {
      const subsection = sections.ungroupedSubsections[subcategory] || [];
      subsection.push({ key, ...row });
      sections.ungroupedSubsections[subcategory] = subsection;
    } else {
      sections.ungrouped.push({ key, ...row });
    }
  });

  // apply sort
  const sortFn = sortFns[sort];

  const sortSubsection = (record: Record<string, Subsection>) => {
    if (!sortFn) {
      return record;
    }
    return Object.keys(record).reduce<Record<string, Subsection>>(
      (acc, cur) => ({
        ...acc,
        [cur]: record[cur].sort(sortFn),
      }),
      {}
    );
  };

  const sorted = {
    ungrouped: sections.ungrouped.sort(sortFn),
    ungroupedSubsections: sortSubsection(sections.ungroupedSubsections),
    sections: Object.keys(sections.sections).reduce<Record<string, Section>>(
      (acc, cur) => ({
        ...acc,
        [cur]: {
          ungrouped: sections.sections[cur].ungrouped.sort(sortFn),
          subsections: sortSubsection(sections.sections[cur].subsections),
        },
      }),
      {}
    ),
  };

  return sorted;
};

/**
 * Wrap CSF's `includeConditionalArg` in a try catch so that invalid conditionals don't break the
 * entire UI. We can safely swallow the error because `includeConditionalArg` is also called in the
 * preview in `prepareStory`, and that exception will be bubbled up into the UI in a red screen.
 * Nevertheless, we log the error here just in case.
 */
const safeIncludeConditionalArg = (row: ArgType, args: Args, globals: Globals) => {
  try {
    return includeConditionalArg(row, args, globals);
  } catch (err) {
    once.warn(err.message);
    return false;
  }
};

/**
 * Display the props for a component as a props table. Each row is a collection of ArgDefs, usually
 * derived from docgen info for the component.
 */
export const ArgsTable: FC<ArgsTableProps> = (props) => {
  const {
    updateArgs,
    resetArgs,
    compact,
    inAddonPanel,
    initialExpandedArgs,
    sort = 'none',
    isLoading,
  } = props;

  if ('error' in props) {
    const { error } = props;
    return (
      <EmptyBlock>
        {error}&nbsp;
        <Link href="http://storybook.js.org/docs/" target="_blank" withArrow>
          <DocumentIcon /> Read the docs
        </Link>
      </EmptyBlock>
    );
  }

  // If the story is loading, show a skeleton
  // This happen when you load the manager and the story is not yet loaded

  // If the story is loading, show a skeleton
  // This happen when you load the manager and the story is not yet loaded
  if (isLoading) {
    return <Skeleton />;
  }

  const { rows, args, globals } = 'rows' in props && props;
  const groups = groupRows(
    pickBy(
      rows,
      (row) => !row?.table?.disable && safeIncludeConditionalArg(row, args || {}, globals || {})
    ),
    sort
  );

  // If there are no controls, show the empty state
  const hasNoUngrouped = groups.ungrouped.length === 0;
  const hasNoSections = Object.entries(groups.sections).length === 0;
  const hasNoUngroupedSubsections = Object.entries(groups.ungroupedSubsections).length === 0;

  if (hasNoUngrouped && hasNoSections && hasNoUngroupedSubsections) {
    return <Empty inAddonPanel={inAddonPanel} />;
  }

  let colSpan = 1;

  if (updateArgs) {
    colSpan += 1;
  }

  if (!compact) {
    colSpan += 2;
  }
  const expandable = Object.keys(groups.sections).length > 0;

  const common = { updateArgs, compact, inAddonPanel, initialExpandedArgs };

  return (
    <ResetWrapper>
      <TableWrapper {...{ compact, inAddonPanel }} className="docblock-argstable sb-unstyled">
        <thead className="docblock-argstable-head">
          <tr>
            <th>
              <span>Name</span>
            </th>
            {compact ? null : (
              <th>
                <span>Description</span>
              </th>
            )}
            {compact ? null : (
              <th>
                <span>Default</span>
              </th>
            )}
            {updateArgs ? (
              <th>
                <ControlHeadingWrapper>
                  Control{' '}
                  {!isLoading && resetArgs && (
                    <StyledIconButton onClick={() => resetArgs()} title="Reset controls">
                      <UndoIcon aria-hidden />
                    </StyledIconButton>
                  )}
                </ControlHeadingWrapper>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="docblock-argstable-body">
          {groups.ungrouped.map((row) => (
            <ArgRow key={row.key} row={row} arg={args && args[row.key]} {...common} />
          ))}

          {Object.entries(groups.ungroupedSubsections).map(([subcategory, subsection]) => (
            <SectionRow key={subcategory} label={subcategory} level="subsection" colSpan={colSpan}>
              {subsection.map((row) => (
                <ArgRow
                  key={row.key}
                  row={row}
                  arg={args && args[row.key]}
                  expandable={expandable}
                  {...common}
                />
              ))}
            </SectionRow>
          ))}

          {Object.entries(groups.sections).map(([category, section]) => (
            <SectionRow key={category} label={category} level="section" colSpan={colSpan}>
              {section.ungrouped.map((row) => (
                <ArgRow key={row.key} row={row} arg={args && args[row.key]} {...common} />
              ))}
              {Object.entries(section.subsections).map(([subcategory, subsection]) => (
                <SectionRow
                  key={subcategory}
                  label={subcategory}
                  level="subsection"
                  colSpan={colSpan}
                >
                  {subsection.map((row) => (
                    <ArgRow
                      key={row.key}
                      row={row}
                      arg={args && args[row.key]}
                      expandable={expandable}
                      {...common}
                    />
                  ))}
                </SectionRow>
              ))}
            </SectionRow>
          ))}
        </tbody>
      </TableWrapper>
    </ResetWrapper>
  );
};
