# Storybook Controls

This directory contains the core Controls functionality for Storybook, which was previously in the `@storybook/addon-controls` package.

Controls gives you a graphical UI to interact with a component's arguments dynamically, without needing to code. It creates an addon panel next to your component examples ("stories"), so you can edit them live.

## Directory Structure

- `components/` - UI components for the Controls panel
- `containers/` - Container components that manage state and data flow
- `models/` - Data models and utilities
- `runtime/` - Runtime-specific code
- `constants.ts` - Constants and configuration
- `decorator.ts` - Story decorator
- `index.ts` - Main entry point
- `manager.tsx` - Manager-side code
- `preview.ts` - Preview-side code
- `types.ts` - TypeScript types

## Migration Status

This code was migrated from the `@storybook/addon-controls` package as part of the effort to consolidate core functionality into the main Storybook package.
