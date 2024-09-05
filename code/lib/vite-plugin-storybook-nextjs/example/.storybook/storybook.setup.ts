import { setProjectAnnotations } from "@storybook/experimental-nextjs-vite";
import { beforeAll, beforeEach } from "vitest";

import * as addonActionsAnnotations from "@storybook/addon-actions/preview";
import * as addonInteractionsAnnotations from "@storybook/addon-interactions/preview";
import * as rendererDocsAnnotations from "@storybook/react/dist/entry-preview-docs.mjs";
import * as rendererRSCAnnotations from "@storybook/react/dist/entry-preview-rsc.mjs";
import * as projectAnnotations from "./preview";

const { cleanup, render: testingLibraryRender } = await import(
  "@testing-library/react/pure"
);

beforeEach(cleanup);

const annotations = setProjectAnnotations([
  rendererRSCAnnotations,
  rendererDocsAnnotations,
  projectAnnotations,
  addonActionsAnnotations,
  addonInteractionsAnnotations,
  { testingLibraryRender },
]);

// biome-ignore lint/style/noNonNullAssertion: being undefined is a bug in Storybook types
beforeAll(annotations.beforeAll!);
