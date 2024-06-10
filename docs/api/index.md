---
title: 'API references'
hideRendererSelector: true
---

<!--
  We intentionally do not use markdown tables here because the required formatting (one row per line)
  makes it very difficult to read, particularly when comparing changes.
  Also, using HTML directly allows us to apply a consistent width to the first column.
  However, this means the links won't work when viewing in GitHub. :(
-->

An overview of all available API references for Storybook.

## Configuration

<table>
  <thead>
    <tr>
      <th scope="col" width="33%">Name</th>
      <th scope="col">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="../api/main-config"><code>main.js|ts</code></a></td>
      <td>
        Storybook's primary configuration file, which specifies your Storybook project's behavior,
        including the location of your stories, the addons you use, feature flags and other
        project-specific settings.
      </td>
    </tr>
    <tr>
      <td><a href="../configure/#configure-story-rendering"><code>preview.js|jsx|ts|tsx</code></a></td>
      <td>
        This configuration file controls the way stories are rendered. You can also use it to run
        code that applies to all stories.
      </td>
    </tr>
    <tr>
      <td><a href="../configure/#configure-storybooks-ui"><code>manager.js|ts</code></a></td>
      <td>
        This configuration file controls the behavior of Storybook's UI, the manager.
      </td>
    </tr>
    <tr>
      <td><a href="../api/cli-options">CLI</a></td>
      <td>
        Storybook is a CLI tool. You can start Storybook in development mode or build a static
        version of your Storybook.
      </td>
    </tr>
  </tbody>
</table>

## Stories

<table>
  <thead>
    <tr>
      <th scope="col" width="33%">Name</th>
      <th scope="col">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="../api/csf">CSF</a></td>
      <td>
        Component Story Format (CSF) is the API for writing stories. It's an 
        <a href="https://github.com/ComponentDriven/csf">open standard</a> based on ES6 modules that
        is portable beyond Storybook.
      </td>
    </tr>
    <tr>
      <td><a href="../api/arg-types">ArgTypes</a></td>
      <td>
        ArgTypes specify the behavior of <a href="../writing-stories/args">args</a>. By specifying
        the type of an arg, you constrain the values that it can accept and provide information
        about args that are not explicitly set.
      </td>
    </tr>
    <tr>
      <td><a href="../api/parameters">Parameters</a></td>
      <td>
        Parameters are static metadata used to configure your <a href="../get-started/whats-a-story.md">stories</a> <a href="../addons/index.md">addons</a> in Storybook. They are specified at the story, meta (component), project (global) levels.
      </td>
    </tr>
  </tbody>
</table>

## Docs

<table>
  <thead>
    <tr>
      <th scope="col" width="33%">Name</th>
      <th scope="col">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="../writing-docs/doc-blocks/#available-blocks">Doc blocks</a></td>
      <td>
        Storybook offers several doc blocks to help document your components and other aspects of
        your project.
      </td>
    </tr>
  </tbody>
</table>
