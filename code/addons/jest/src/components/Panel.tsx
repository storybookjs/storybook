import type { FC } from 'react';
import React, { Fragment, useMemo } from 'react';

import { Badge, Link, Placeholder, ScrollArea, TabsView } from 'storybook/internal/components';

import { useResizeDetector } from 'react-resize-detector';
import { convert, styled, themes } from 'storybook/theming';

import type { AssertionResult, Test } from '../hoc/provideJestResult';
import { provideTests as provideJestResult } from '../hoc/provideJestResult';
import { Result } from './Result';

const StatusTypes = {
  PASSED_TYPE: 'passed',
  FAILED_TYPE: 'failed',
  PENDING_TYPE: 'pending',
  TODO_TYPE: 'todo',
};

const List = styled.ul({
  listStyle: 'none',
  fontSize: 14,
  padding: 0,
  margin: 0,
});

const Item = styled.li({
  display: 'block',
  padding: 0,
});

const ProgressWrapper = styled.div({
  width: 30,
  display: 'flex',
});

const SuiteHead = styled.div({
  display: 'flex',
  alignItems: 'center',
  marginInlineEnd: 5,
  gap: 15,
});

const UnstyledSuiteTotals: FC<{
  result: Test['result'];
  className?: string;
  width: number;
}> = ({ result, className, width }) => (
  <div className={className}>
    <Fragment>
      {width > 325 && result.assertionResults ? (
        <div>
          {result.assertionResults.length} {result.assertionResults.length > 1 ? `tests` : `test`}
        </div>
      ) : null}
      {width > 280 && result.endTime && result.startTime ? (
        <div>
          {result.endTime - result.startTime}
          ms
        </div>
      ) : null}
    </Fragment>
  </div>
);
const SuiteTotals = styled(UnstyledSuiteTotals)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  color: theme.color.dark,
  fontSize: '14px',
  flexShrink: 0,
}));

const SuiteProgressPortion = styled.div<{ color?: string; progressPercent: number }>(
  ({ color, progressPercent }) => ({
    height: 6,
    top: 3,
    width: `${progressPercent}%`,
    backgroundColor: color,
  })
);

interface ContentProps {
  tests: Test[];
  className?: string;
}

const getTestsByTypeMap = (result: Test['result']) => {
  const testsByType: Map<string, AssertionResult[]> = new Map();
  result.assertionResults.forEach((assertion) => {
    const existingTestsForType = testsByType.get(assertion.status);

    testsByType.set(
      assertion.status,
      existingTestsForType ? existingTestsForType.concat(assertion) : [assertion]
    );
  });
  return testsByType;
};

const getColorByType = (type: string) => {
  // using switch to allow for new types to be added
  switch (type) {
    case StatusTypes.PASSED_TYPE:
      return convert(themes.light).color.positive;
    case StatusTypes.FAILED_TYPE:
      return convert(themes.light).color.negative;
    case StatusTypes.PENDING_TYPE:
      return convert(themes.light).color.warning;
    case StatusTypes.TODO_TYPE:
      return convert(themes.light).color.purple;
    default:
      return undefined;
  }
};

const TabItemWrapper = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

const TabItem: FC<{ count: number; title: string }> = ({ count, title }) => (
  <TabItemWrapper>
    {title}
    <Badge compact status="neutral">
      {count}
    </Badge>
  </TabItemWrapper>
);

const TabPanel: FC<{
  emptyMessage: string;
  tests: AssertionResult[];
}> = ({ emptyMessage, tests }) => (
  <List>
    {tests.length ? (
      tests?.map((res: AssertionResult) => (
        <Item key={res.fullName || res.title}>
          <Result {...res} />
        </Item>
      ))
    ) : (
      <Placeholder>{emptyMessage}</Placeholder>
    )}
  </List>
);

const TestPanel: FC<{ test: Test }> = ({ test }) => {
  const { ref, width } = useResizeDetector();
  const { result } = test;
  if (!result || !result.assertionResults) {
    return <Placeholder>This story has tests configured, but no file was found</Placeholder>;
  }

  const testsByType: Map<string, AssertionResult[]> = useMemo(
    () => getTestsByTypeMap(result),
    [result]
  );
  const tabs = useMemo(
    () => [
      {
        id: 'failing-tests',
        title: (
          <TabItem count={testsByType.get(StatusTypes.FAILED_TYPE)?.length ?? 0} title="Failing" />
        ),
        children: () => (
          <TabPanel
            emptyMessage="This story has no failing tests."
            tests={testsByType.get(StatusTypes.FAILED_TYPE) ?? []}
          />
        ),
      },
      {
        id: 'passing-tests',
        title: (
          <TabItem count={testsByType.get(StatusTypes.PASSED_TYPE)?.length ?? 0} title="Passing" />
        ),
        children: () => (
          <TabPanel
            emptyMessage="This story has no passing tests."
            tests={testsByType.get(StatusTypes.PASSED_TYPE) ?? []}
          />
        ),
      },
      {
        id: 'pending-tests',
        title: (
          <TabItem count={testsByType.get(StatusTypes.PENDING_TYPE)?.length ?? 0} title="Pending" />
        ),
        children: () => (
          <TabPanel
            emptyMessage="This story has no pending tests."
            tests={testsByType.get(StatusTypes.PENDING_TYPE) ?? []}
          />
        ),
      },
      {
        id: 'todo-tests',
        title: (
          <TabItem count={testsByType.get(StatusTypes.TODO_TYPE)?.length ?? 0} title="To Do" />
        ),
        children: () => (
          <TabPanel
            emptyMessage="This story has no tests to do."
            tests={testsByType.get(StatusTypes.TODO_TYPE) ?? []}
          />
        ),
      },
    ],
    [testsByType]
  );

  const entries = testsByType.entries();
  const sortedTestsByCount = [...entries].sort((a, b) => a[1].length - b[1].length);

  return (
    <section ref={ref}>
      <TabsView
        defaultSelected="failing-tests"
        backgroundColor={convert(themes.light).background.hoverable}
        tabs={tabs}
        tools={
          <SuiteHead>
            <SuiteTotals {...{ result, width: width ?? 0 }} />
            {width != null && width > 240 ? (
              <ProgressWrapper>
                {sortedTestsByCount.map((entry) => {
                  return (
                    <SuiteProgressPortion
                      key={`progress-portion-${entry[0]}`}
                      color={getColorByType(entry[0])}
                      progressPercent={
                        entry[1] ? (entry[1].length / result.assertionResults.length) * 100 : 0
                      }
                    />
                  );
                })}
              </ProgressWrapper>
            ) : null}
          </SuiteHead>
        }
      />
    </section>
  );
};

const Content = styled(({ tests, className }: ContentProps) => (
  <div className={className}>
    {tests.map((test) => (
      <TestPanel key={test.name} test={test} />
    ))}
  </div>
))({
  flex: '1 1 0%',
});

interface PanelProps {
  tests?: Test[];
}

const TallPlaceholder = styled(Placeholder)({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
});

const Panel = ({ tests }: PanelProps) => (
  <ScrollArea vertical>
    {tests ? (
      <Content tests={tests} />
    ) : (
      <TallPlaceholder>
        <Fragment>No tests found</Fragment>
        <Fragment>
          Learn how to&nbsp;
          <Link
            href="https://github.com/storybookjs/storybook/tree/master/addons/jest"
            target="_blank"
            withArrow
          >
            add Jest test results to your story
          </Link>
        </Fragment>
      </TallPlaceholder>
    )}
  </ScrollArea>
);

Panel.defaultProps = {
  tests: undefined,
};

export default provideJestResult(Panel);
