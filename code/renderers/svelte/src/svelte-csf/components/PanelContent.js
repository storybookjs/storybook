import React, { Fragment } from "react";
import { styled, themes, convert } from "@storybook/theming";
import { TabsState, Placeholder, Button } from "@storybook/components";
import { List } from "./List";

export const RequestDataButton = styled(Button)({
  marginTop: "1rem",
});

/**
 * Checkout https://github.com/storybookjs/storybook/blob/next/addons/jest/src/components/Panel.tsx
 * for a real world example
 */
export const PanelContent = ({ results, fetchData, clearData }) => (
  <TabsState
    initial="overview"
    backgroundColor={convert(themes.normal).background.hoverable}
  >
    <div
      id="overview"
      title="Overview"
      color={convert(themes.normal).color.positive}
    >
      <Placeholder>
        <Fragment>
          Addons can gather details about how a story is rendered. This is panel
          uses a tab pattern. Click the button below to fetch data for the other
          two tabs.
        </Fragment>
        <Fragment>
          <RequestDataButton
            secondary
            small
            onClick={fetchData}
            style={{ marginRight: 16 }}
          >
            Request data
          </RequestDataButton>

          <RequestDataButton outline small onClick={clearData}>
            Clear data
          </RequestDataButton>
        </Fragment>
      </Placeholder>
    </div>
    <div
      id="danger"
      title={`${results.danger.length} Danger`}
      color={convert(themes.normal).color.negative}
    >
      <List items={results.danger} />
    </div>
    <div
      id="warning"
      title={`${results.warning.length} Warning`}
      color={convert(themes.normal).color.warning}
    >
      <List items={results.warning} />
    </div>
  </TabsState>
);
