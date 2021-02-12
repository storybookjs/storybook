import React from "react";
import { styled } from "@storybook/theming";
import { Title, Source, Link } from "@storybook/components";

const TabWrapper = styled.div(({ theme }) => ({
  background: theme.background.content,
  padding: "4rem 20px",
  minHeight: "100vh",
  boxSizing: "border-box",
}));

const TabInner = styled.div(({ theme }) => ({
  maxWidth: 768,
  marginLeft: "auto",
  marginRight: "auto",
}));

export const TabContent = ({ code }) => (
  <TabWrapper>
    <TabInner>
      <Title>My Addon</Title>
      <p>
        Your addon can create a custom tab in Storybook. For example, the
        official{" "}
        <Link href="https://storybook.js.org/docs/react/writing-docs/introduction">
          @storybook/addon-docs
        </Link>{" "}
        uses this pattern.
      </p>
      <p>
        You have full control over what content is being rendered here. You can
        use components from{" "}
        <Link href="https://github.com/storybookjs/storybook/tree/master/lib/components">
          @storybook/components
        </Link>{" "}
        to match the look and feel of Storybook, for example the{" "}
        <code>&lt;Source /&gt;</code> component below. Or build a completely
        custom UI.
      </p>
      <Source code={code} language="jsx" format={false} />
    </TabInner>
  </TabWrapper>
);
