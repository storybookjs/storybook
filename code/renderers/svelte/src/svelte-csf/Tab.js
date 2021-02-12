import React from "react";
import { useParameter } from "@storybook/api";
import { PARAM_KEY } from "./constants";
import { TabContent } from "./components/TabContent";

export const Tab = ({ active }) => {
  // https://storybook.js.org/docs/react/addons/addons-api#useparameter
  const paramData = useParameter(PARAM_KEY, []);

  return active ? <TabContent code={paramData} /> : null;
};
