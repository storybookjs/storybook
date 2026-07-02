import { test } from 'vitest';
import {
	expectDisplayReviewForVisualChange,
	expectPreviewBrowserStarted,
	expectValidStorybookLaunchConfig,
	expectWorkflowCalls,
} from '#test-utils';

// Unlike 801, the template's valid .claude/launch.json is left intact, so the
// plugin must reuse the existing config instead of writing a fresh one.

// A ProfileCard (avatar/initials, tags, action buttons) is built from
// Reshaped primitives (Avatar, Badge, Button, …), and their props must come
// from the documentation tools — never guessed or read out of
// node_modules/reshaped/dist. Enabled with storybookjs/mcp#320, like 801.
test('uses the documentation tooling', () => {
	expectWorkflowCalls(['get-documentation']);
});

test('uses Storybook story instructions and publishes a display review', () => {
	expectWorkflowCalls(['get-storybook-story-instructions', 'display-review']);
	expectDisplayReviewForVisualChange();
});

test('keeps the pre-existing Storybook launch config valid', () => {
	expectValidStorybookLaunchConfig();
});

test('opens the preview browser when using the plugin', () => {
	expectPreviewBrowserStarted();
});
