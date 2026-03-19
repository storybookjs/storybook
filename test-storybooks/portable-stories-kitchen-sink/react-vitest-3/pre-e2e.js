/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("node:fs");
const path = require("node:path");

const testStoryPath = path.resolve("stories/AddonTest.stories.tsx");

console.log(`Pre-e2e script: clearing ${testStoryPath}`);
const storyContent = fs.readFileSync(testStoryPath).toString();
fs.writeFileSync(testStoryPath, storyContent.replace("forceFailure: true", "forceFailure: false"));