# Storybook Story Inspector

A Storybook addon that helps you visualize which components in your stories have corresponding story files and which don't.

## Features

- 🔍 **Visual Component Inspection**: Highlights components in your stories with color-coded indicators
- ✅ **Story Status Indication**: Green highlights for components that have stories, orange for those that don't
- 🚀 **Quick Navigation**: Click highlighted components with stories to navigate directly to them
- ➕ **Story Creation**: Click highlighted components without stories to automatically create a story file
- 🎯 **Smart Detection**: Uses file path metadata to accurately match components to their story files

## How it works

1. **File Transformation**: A Vite plugin automatically injects component file path metadata into your JSX elements during build
2. **Component Detection**: The addon scans the rendered story for components with this metadata
3. **Story Matching**: Components are matched against the story index to determine if they have stories
4. **Visual Feedback**: Components are highlighted with different colors based on their story status
5. **Interactive Actions**: Click highlights to navigate to stories or create new ones

## Usage

1. Install the addon (it's included as an internal Storybook addon)
2. Click the eye icon in the Storybook toolbar to enable story inspection
3. Components will be highlighted:
   - **Green**: Component has stories - click to navigate
   - **Orange**: Component has no stories - click to create one

## Highlighting Colors

- 🟢 **Green**: Components that have corresponding story files
- 🟠 **Orange**: Components that don't have story files yet

## Creating Stories

When you click on an orange-highlighted component (one without stories), the addon will:

1. Automatically create a new story file for that component
2. Generate basic story structure with sensible defaults
3. Navigate you to the newly created story
4. Show a success notification

## Technical Details

This addon consists of:

- **Vite Plugin**: Injects component file paths as data attributes
- **Manager Extension**: Provides toolbar controls and highlighting logic
- **Story Matching**: Compares component paths against the story index
- **Story Creation**: Integrates with Storybook's story creation APIs

## Limitations

- Currently optimized for Vite-based Storybook setups
- Works best with React components (JSX/TSX)
- Requires components to be in separate files for accurate detection
