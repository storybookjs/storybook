# Using the Story Inspector Addon

The Story Inspector addon helps you visualize which components in your Storybook stories have corresponding story files and which don't. This is particularly useful for large codebases where you want to ensure story coverage for your components.

## Installation and Setup

### For Internal Use (Development)

The addon is built as an internal Storybook addon. To use it in your Storybook:

1. **Add to your `.storybook/main.ts`:**

```typescript
module.exports = {
  // ... other config
  addons: [
    // ... other addons
    '@storybook/addon-story-inspector',
  ],
};
```

2. **Ensure Vite is used as your builder** (required for the component path injection):

```typescript
module.exports = {
  framework: {
    name: '@storybook/react-vite', // or another vite-based framework
    options: {},
  },
  // ... other config
};
```

## How to Use

### 1. Enable the Inspector

- Look for the eye icon 👁️ in the Storybook toolbar
- Click it to toggle the Story Inspector on/off
- The icon will show a badge with the number of detected components when active

### 2. View Component Highlights

When enabled, components in your stories will be highlighted with colored outlines:

- **🟢 Green**: Components that have existing story files
- **🟠 Orange**: Components that don't have story files yet

### 3. Interact with Highlighted Components

Click on any highlighted component to see a context menu with options:

**For components WITH stories (green):**

- "Go to story" - Navigate directly to the component's story

**For components WITHOUT stories (orange):**

- "Create story" - Automatically create a new story file for the component

### 4. Creating Stories Automatically

When you click "Create story" on an orange-highlighted component:

1. The addon automatically creates a new story file
2. Generates basic story structure with sensible defaults
3. Navigates you to the newly created story
4. Shows a success notification

## What Gets Detected

The Story Inspector detects:

- React components (JSX/TSX files)
- Vue components (`.vue` files)
- Svelte components (`.svelte` files)

It excludes:

- Story files (`.stories.*`)
- Test files (`.test.*`, `.spec.*`)
- Node modules
- HTML elements (lowercase tags)

## Technical Details

### How It Works

1. **Build-time injection**: A Vite plugin injects `data-sb-component-path` attributes into component elements
2. **Runtime detection**: The addon scans rendered stories for these attributes
3. **Story matching**: Component paths are matched against the story index to determine story existence
4. **Visual feedback**: Components are highlighted using the same system as the a11y addon

### File Path Matching

The addon matches components to stories by comparing:

- Component file path (from the injected metadata)
- `rawComponentPath` field in story index entries

Paths are normalized to handle cross-platform differences (Windows vs Unix paths).

## Limitations

- **Vite-only**: Currently works only with Vite-based Storybook setups
- **Component detection**: Only detects components that render as distinct elements
- **Path accuracy**: Relies on accurate file path metadata injection

## Troubleshooting

### Components not being detected

- Ensure you're using a Vite-based framework
- Check that components are being rendered in the story
- Verify component names start with uppercase letters (React convention)

### Story creation failing

- Ensure the component file exists and is accessible
- Check that you have write permissions in the project directory
- Verify the component exports are structured correctly

### Performance

- The inspector scans the DOM when enabled, which may impact performance with many components
- Consider disabling when not needed for story development

## Development Notes

The addon consists of:

- **Vite Plugin**: Injects component metadata during build
- **Manager UI**: Provides toolbar controls and highlighting
- **Story Creation**: Integrates with Storybook's story creation APIs
- **Highlighting System**: Uses the same highlighting infrastructure as other addons

For more details, see the implementation in `code/addons/story-inspector/src/`.
