import { composeStories, composeStory } from "@storybook/react-vite";
import * as stories from "./Button.stories";

export default composeStories(stories);

export const SingleComposedStory = composeStory(
  stories.CSF3Primary,
  stories.default
);

export const WithSpanishGlobal = composeStory(
  stories.CSF2StoryWithLocale,
  stories.default,
  { initialGlobals: { locale: "es" } }
);
