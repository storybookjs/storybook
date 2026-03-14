# @storybook/addon-performance

A Storybook addon that measures and visualizes React component render performance.

## Features

- **React Profiler Integration** - Measures actual render times using React's built-in Profiler API
- **Re-render Detection** - Counts and tracks component re-renders
- **Web Vitals** - Monitors Cumulative Layout Shift (CLS) and long tasks (>50ms)
- **Performance Budgets** - Set thresholds and get warnings when exceeded
- **Visual Dashboard** - Real-time metrics panel with charts
- **CI Reporter** - Export JSON reports for performance regression testing

## Installation

```bash
npm install @storybook/addon-performance
# or
yarn add @storybook/addon-performance
# or
pnpm add @storybook/addon-performance
```

## Setup

Add the addon to your `.storybook/main.ts`:

```ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  addons: ['@storybook/addon-performance'],
};

export default config;
```

That's it! The addon will automatically wrap your stories with performance tracking.

## Configuration

### Global Budget

Set default performance budgets for all stories:

```ts
// .storybook/main.ts
export default {
  addons: [
    {
      name: '@storybook/addon-performance',
      options: {
        budget: {
          renderTime: 16,      // ms (default: 16 for 60fps)
          rerenderLimit: 2,    // max re-renders (default: 2)
          cls: 0.1,            // CLS threshold (default: 0.1)
          longTasks: 0,        // long task count (default: 0)
        },
      },
    },
  ],
};
```

### Per-Story Budget

Override budgets for specific stories:

```ts
// Button.stories.ts
export default {
  title: 'Components/Button',
  parameters: {
    performance: {
      budget: {
        renderTime: 20,    // This component is allowed 20ms
        rerenderLimit: 5,  // And up to 5 re-renders
      },
    },
  },
};

export const Primary = {
  args: { label: 'Click me' },
};
```

### Disable for a Story

```ts
export const ExpensiveComponent = {
  parameters: {
    performance: {
      disable: true,
    },
  },
};
```

## Panel Features

The Performance panel shows:

- **Budget Status** - Overall pass/warn/fail indicator
- **Avg Render Time** - Average time spent rendering
- **Re-renders** - Count of re-renders after initial mount
- **Total Renders** - Total render count including mount
- **CLS** - Cumulative Layout Shift score
- **Long Tasks** - Count of tasks exceeding 50ms
- **Render Timeline** - Visual chart of render history
- **Recent Renders** - Detailed list of recent render events

## Metrics Explained

### Render Time (actualDuration)
Time spent rendering the committed update. This is what you want to optimize.

### Base Duration
Estimated time to render without memoization (React.memo, useMemo, useCallback). Useful for understanding potential optimization gains.

### Re-renders
Updates after the initial mount. High counts may indicate:
- Missing memoization
- Unstable prop references
- Unnecessary state updates

### CLS (Cumulative Layout Shift)
Measures visual stability. Values:
- Good: < 0.1
- Needs improvement: 0.1 - 0.25
- Poor: > 0.25

### Long Tasks
JavaScript tasks exceeding 50ms that block the main thread.

## Export & CI

### Export JSON
Click the download button in the panel to export metrics as JSON.

### CI Integration
Use the reporter utilities for CI pipelines:

```ts
import { generateReport, formatReportJson } from '@storybook/addon-performance';

// Generate report from collected data
const report = generateReport(storyData, storyMeta, budget);
const json = formatReportJson(report);

// Write to file for CI artifact
fs.writeFileSync('perf-report.json', json);
```

## API

### Types

```ts
interface PerformanceParameters {
  disable?: boolean;
  budget?: {
    renderTime?: number;
    rerenderLimit?: number;
    cls?: number;
    longTasks?: number;
  };
}

interface ProfilerData {
  id: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  timestamp: number;
}
```

### Hooks

```ts
import { usePerformanceData } from '@storybook/addon-performance';

function CustomPanel({ storyId }) {
  const { data, clearData, isLoading } = usePerformanceData(storyId);
  // ...
}
```

### Utilities

```ts
import { 
  evaluateBudget, 
  formatMs, 
  getStatusColor 
} from '@storybook/addon-performance';

const status = evaluateBudget(data, budget);
console.log(formatMs(data.avgRenderTime)); // "12.34ms"
```

## Browser Support

- React Profiler: All browsers
- CLS tracking: Chromium-based browsers
- Long task detection: Chromium-based browsers

The addon gracefully degrades when Performance Observer APIs are unavailable.

## Framework Support

Currently supports:
- ✅ React
- 🔜 Vue (planned)
- 🔜 Angular (planned)

## License

MIT
