import type { FC } from 'react';
import React from 'react';

import { H2, H3, H4, H5, Link } from 'storybook/internal/components';

import { shortcutToHumanString } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

const Container = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2,
}));

const Kbd = styled.kbd(({ theme }) => ({
  background: theme.base === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
  borderRadius: theme.appBorderRadius,
  border: `1px solid ${theme.appBorderColor}`,
  display: 'inline-block',
  padding: '2px 6px',
  fontFamily: theme.typography.fonts.mono,
}));

const Shortcut: FC<{ shortcut: string }> = ({ shortcut }) => {
  const human = shortcutToHumanString([shortcut]);
  return <Kbd aria-label={shortcut}>{human}</Kbd>;
};
const Code = styled.pre(({ theme }) => ({
  background: theme.base === 'light' ? 'rgba(0, 0, 0, 0.05)' : theme.appBorderColor,
  fontSize: theme.typography.size.s2 - 1,
  margin: '4px 0 16px',
}));

const A11yStatement: FC = () => (
  <Container>
    <H2>Accessibility Statement for Storybook</H2>
    <p>This is an accessibility statement for the Storybook application.</p>

    <H3>Conformance status</H3>
    <p>
      The{' '}
      <Link href="https://www.w3.org/WAI/standards-guidelines/wcag/">
        Web Content Accessibility Guidelines (WCAG)
      </Link>{' '}
      defines requirements for designers and developers to improve accessibility for people with
      disabilities. It defines three levels of conformance: Level A, Level AA, and Level AAA.
    </p>
    <p>
      Storybook is <strong>partially conformant</strong> with <strong>WCAG 2.2 level AA</strong>.
      Partially conformant means that some parts of the content do not fully conform to the
      accessibility standard.
    </p>

    <H3>Measures to support accessibility</H3>
    <p>
      The Storybook maintainers take the following measures to ensure the accessibility of
      Storybook:
    </p>
    <ul>
      <li>Include accessibility throughout our development workflow</li>
      <li>Test new features for accessibility issues</li>
      <li>Monitor Storybook automatically for accessibility regressions</li>
      <li>Request review from external accessibility experts on specific features</li>
    </ul>

    <H3>Feedback</H3>
    <p>
      We welcome your feedback on the accessibility of Storybook. Please let us know if you
      encounter accessibility barriers on Storybook by{' '}
      <Link href="https://github.com/storybookjs/storybook/issues/new?template=bug_report.yml">
        filling a bug report
      </Link>
      .
    </p>
    <p>We try to respond to feedback within one to two weeks.</p>

    <H3>Compatibility</H3>
    <p>Storybook is designed to be compatible with the following assistive technologies:</p>
    <ul>
      <li>Chrome with NVDA on Windows</li>
      <li>Firefox with NVDA on Windows</li>
      <li>Safari with VoiceOver on Mac</li>
      {/* <li>Firefox with Orca on ArchLinux</li> TODO */}
    </ul>
    <p>
      Storybook is not tested with the following technologies and may not be compatible with them:
    </p>
    <ul>
      <li>Browsers older than Chrome 131, Edge 134, Firefox 136, Safari 18.3, and Opera 117</li>
      <li>The Narrator and JAWS screen readers</li>
    </ul>

    <H3>Technical specifications</H3>
    <p>
      Accessibility of Storybook relies on the following technologies to work with the particular
      combination of web browser and any assistive technologies or plugins installed on your
      computer:
    </p>
    <ul>
      <li>HTML</li>
      <li>WAI-ARIA</li>
      <li>CSS</li>
      <li>JavaScript</li>
    </ul>
    <p>These technologies are relied upon for conformance with the accessibility standards used.</p>

    <H3>Limitations and alternatives</H3>
    <p>
      Despite our best efforts to ensure the accessibility of Storybook, there are some limitations.
      Below is a description of the most impactful limitations, and potential solutions.
    </p>
    <p>
      Please{' '}
      <Link href="https://github.com/storybookjs/storybook/issues/new?template=bug_report.yml">
        fill a bug report
      </Link>{' '}
      if you observe an issue not listed below or on our{' '}
      <Link href="https://github.com/orgs/storybookjs/projects/23/views/1">
        accessibility bug tracker
      </Link>
      .
    </p>

    <H4>Sidebar navigation is not accessible with the keyboard</H4>
    <p>
      Navigating through stories in the sidebar is difficult, and the context menus next to each
      component (which let you run tests for that specific component) are not reachable by keyboard.
      We are currently testing an alternative design of the sidebar that works well with keyboards
      and major screen readers.
    </p>
    <p>
      If you use the search bar to find specific stories, press the <Shortcut shortcut="ArrowUp" />{' '}
      and <Shortcut shortcut="ArrowDown" /> keys from the search input to navigate to search
      results.
    </p>
    <p>
      If you use the sidebar directly, press <Shortcut shortcut="Tab" /> to navigate between content
      sections, and press <Shortcut shortcut="ArrowUp" /> and <Shortcut shortcut="ArrowDown" /> to
      enter a content section when on the title of a section. Each section is immediately followed
      by a button to expand all items within the section. Make sure to expand all items before
      navigating in the section, as expanding and collapsing individual items is not currently
      possible with the keyboard alone.
    </p>

    <H4>Storybook Vitest addon limitations</H4>
    <H5>Test result are not announced</H5>
    <p>
      The test widget provided by the{' '}
      <Link href="https://storybook.js.org/docs/writing-tests/integrations/vitest-addon">
        Vitest addon
      </Link>{' '}
      at the bottom of the sidebar allows you to run tests on all stories, but it does not report
      when tests are done running. We will implement live announcements in a future update to
      address this issue. If you have few tests to run, results will be available after
      approximately ten seconds. If you have hundreds of tests, it can take a few minutes for tests
      to complete. Please wait and recheck the test widget manually for results.
    </p>
    <H5>Tests cannot be run per component</H5>
    <p>
      It is not currently possible to run tests on a specific component with the keyboard only. We
      will fix this issue alongside the sidebar navigation improvements. In the meantime, you can
      run tests in your terminal application via Vitest, which can{' '}
      <Link href="https://vitest.dev/guide/filtering">run tests for specific files</Link>:
    </p>
    <Code>vitest --project=storybook</Code>

    <H4>Interactive stories always auto-play</H4>
    <p>
      Interactive stories on Storybook play automatically as you navigate to them. This is harmful
      to some users, but disabling that feature requires a few underlying changes to how Storybook
      functions.. We are working on a solution to disable autoplay based on user motion preferences.
      In the meantime, please ask your Storybook administrator to follow the{' '}
      <Link href="https://github.blog/engineering/user-experience/how-to-make-storybook-interactions-respect-user-motion-preferences/">
        workaround
      </Link>{' '}
      kindly provided by the GitHub Design System team.
    </p>

    <H3>Assessment approach</H3>
    <p>Storybook assessed the accessibility of Storybook by the following approaches:</p>
    <ul>
      <li>Self-evaluation</li>
    </ul>

    <H3>Date</H3>
    <p>This statement was created on 2 January 2026.</p>
  </Container>
);

export { A11yStatement };
