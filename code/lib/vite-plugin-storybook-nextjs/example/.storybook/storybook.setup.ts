import { setProjectAnnotations } from "@storybook/nextjs";
import React from "react";
import { beforeAll, beforeEach } from "vitest";

import * as projectAnnotations from "./preview";

// @ts-ignore no types
import moduleAlias from "module-alias";

moduleAlias.addAlias(
  "react/jsx-runtime",
  require.resolve("next/dist/compiled/react/jsx-runtime.js"),
);
moduleAlias.addAlias("react", require.resolve("next/dist/compiled/react"));
moduleAlias.addAlias(
  "react-dom/test-utils",
  require.resolve(
    "next/dist/compiled/react-dom/cjs/react-dom-test-utils.production.js",
  ),
);
moduleAlias.addAlias(
  "react-dom/cjs/react-dom.development.js",
  require.resolve("next/dist/compiled/react-dom/cjs/react-dom.development.js"),
);
moduleAlias.addAlias(
  "react-dom/client",
  require.resolve("next/dist/compiled/react-dom/client.js"),
);
moduleAlias.addAlias(
  "react-dom",
  require.resolve("next/dist/compiled/react-dom"),
);

const { cleanup, render: testingLibraryRender } = await import(
  "@testing-library/react/pure"
);

beforeEach(cleanup);

const annotations = setProjectAnnotations([
  projectAnnotations,
  { testingLibraryRender },
]);

// biome-ignore lint/style/noNonNullAssertion: being undefined is a bug in Storybook types
beforeAll(annotations.beforeAll!);
