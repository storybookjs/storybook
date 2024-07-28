import { setProjectAnnotations } from "@storybook/nextjs";
import { beforeAll, beforeEach } from "vitest";

import * as projectAnnotations from "./preview";

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
