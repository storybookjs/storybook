---
name: init
description: Initialize Storybook and Storybook MCP in a project that does not already have Storybook configured.
---

# Storybook MCP Init

Use this skill when the current project needs Storybook before Storybook MCP can be configured.

## Workflow

1. Inspect the project framework, package manager, and existing scripts.
2. Run the standard Storybook initialization flow for the detected framework.
3. Install and configure `@storybook/addon-mcp`.
4. Preserve any generated Storybook config unless a focused edit is required for MCP.
5. Start Storybook with the generated or existing Storybook script.
6. Verify the local Storybook `/mcp` endpoint through the Storybook MCP proxy.

If the project framework is ambiguous, inspect source files and package dependencies before choosing a Storybook framework package.
