import { setProjectAnnotations } from "@storybook/nextjs";
import {
  cleanup,
  render as testingLibraryRender,
} from "@testing-library/react/pure";
import { beforeAll, beforeEach } from "vitest";

import * as projectAnnotations from "./.storybook/preview";

beforeEach(cleanup);

const annotations = setProjectAnnotations([
  projectAnnotations,
  { testingLibraryRender },
]);

// biome-ignore lint/style/noNonNullAssertion: being undefined is a bug in Storybook types
beforeAll(annotations.beforeAll!);
