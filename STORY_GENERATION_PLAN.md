# Story Generation and Testing Flow Plan

## Overview

This plan outlines the implementation of a one-time flow that executes when the `CreateNewStoryFileModal` opens in Storybook. The flow will:

1. Generate 20 stories using the existing story generation logic with sampling
2. Run Vitest tests on the generated stories to collect pass/fail results
3. Send telemetry with test results
4. Report results back to the modal

## Current Codebase Analysis

### Story Generation Logic (`code/lib/cli-storybook/src/generate-stories.ts`)

- Uses `findEasyToStorybookComponents()` to identify suitable components using complexity analysis
- Filters components based on auth, data fetching, routing, and complexity criteria
- Generates stories using `generateStoryFile()` from core-server
- Uses sampling logic to select top components by simplicity score

### CreateNewStoryFileModal (`code/core/src/manager/components/sidebar/CreateNewStoryFileModal.tsx`)

- Opens when `open` prop is true
- Uses request-response pattern with core events for communication
- Currently handles file search and story creation

### Vitest Integration (`code/addons/vitest/`)

- `VitestManager` class handles test execution
- Uses universal store for state management
- Supports running tests on specific story IDs
- Reports test results through store events

### Core Events System (`code/core/src/core-events/`)

- Request-response pattern for manager ↔ core-server communication
- Existing events for story creation, file search, etc.
- Need to add new events for this flow

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1. Define New Core Events

**Files to modify:**

- `code/core/src/core-events/index.ts`
- `code/core/src/core-events/data/` (new request/response types)

**New Events:**

- `STORY_GENERATION_REQUEST` / `STORY_GENERATION_RESPONSE`
- `BULK_STORY_TEST_REQUEST` / `BULK_STORY_TEST_RESPONSE`

**Request/Response Payloads:**

```typescript
interface StoryGenerationRequestPayload {
  sampleSize: number; // 20
  globPattern?: string; // optional glob pattern for component search
}

interface StoryGenerationResponsePayload {
  success: boolean;
  generatedStories: Array<{
    storyId: string;
    storyFilePath: string;
    componentName: string;
  }>;
  error?: string;
}

interface BulkStoryTestRequestPayload {
  storyIds: string[];
}

interface BulkStoryTestResponsePayload {
  success: boolean;
  results: Array<{
    storyId: string;
    status: 'PASS' | 'FAIL';
    error?: string;
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}
```

#### 2. Extract Story Generation Logic to Core-Server

**Files to create/modify:**

- `code/core/src/core-server/utils/story-generation.ts` (new)
- Move logic from `code/lib/cli-storybook/src/generate-stories.ts`

**Key Functions to Extract:**

- `findEasyToStorybookComponents()`
- Component analysis and filtering logic
- Story generation orchestration

**New API Structure:**

```typescript
export interface StoryGenerationAPI {
  generateSampledStories(options: {
    sampleSize: number;
    globPattern?: string;
    options: Options;
  }): Promise<StoryGenerationResult>;
}
```

### Phase 2: Core-Server API Implementation

#### 3. Create Story Generation API Endpoint

**Files to create:**

- `code/core/src/core-server/server-channel/story-generation-channel.ts` (new)

**Implementation:**

- Handle `STORY_GENERATION_REQUEST` events
- Use extracted logic to generate 20 stories
- Return generated story metadata
- Handle errors and edge cases

#### 4. Create Vitest Test Execution API

**Files to create:**

- `code/core/src/core-server/server-channel/bulk-story-test-channel.ts` (new)

**Implementation:**

- Handle `BULK_STORY_TEST_REQUEST` events
- Use Vitest addon APIs to run tests on specific story IDs
- Collect test results (pass/fail counts)
- Return aggregated results

**Integration with Vitest Addon:**

- Access Vitest manager through existing addon system
- Use `runTests()` method with story IDs
- Listen for test completion events
- Aggregate results into response payload

### Phase 3: Manager-Side Integration

#### 5. Modify CreateNewStoryFileModal

**File to modify:**

- `code/core/src/manager/components/sidebar/CreateNewStoryFileModal.tsx`

**Changes:**

- Add `useEffect` hook to trigger flow when `open` becomes true
- Add state for flow progress/results
- Add UI indicators for flow status
- Handle flow completion and display results

**New State:**

```typescript
const [flowStatus, setFlowStatus] = useState<'idle' | 'generating' | 'testing' | 'complete'>(
  'idle'
);
const [flowResults, setFlowResults] = useState<{
  generatedCount: number;
  testResults: { passed: number; failed: number };
} | null>(null);
```

#### 6. Implement Flow Orchestration

**New Logic in Modal:**

```typescript
useEffect(() => {
  if (open && flowStatus === 'idle') {
    executeStoryGenerationFlow();
  }
}, [open, flowStatus]);

const executeStoryGenerationFlow = async () => {
  try {
    // 1. Generate stories
    setFlowStatus('generating');
    const generationResult = await requestResponse(/* story generation */);

    // 2. Run tests
    setFlowStatus('testing');
    const testResult = await requestResponse(/* bulk story test */);

    // 3. Send telemetry
    await sendTelemetry(testResult);

    // 4. Update UI
    setFlowResults({
      generatedCount: generationResult.generatedStories.length,
      testResults: testResult.summary,
    });
    setFlowStatus('complete');
  } catch (error) {
    // Handle errors
    setFlowStatus('idle');
  }
};
```

### Phase 4: Telemetry Integration

#### 7. Add Telemetry Call

**Implementation:**

- Use existing `telemetry()` function
- Send event type: `'story-generation-test-results'`
- Include payload with generation and test metrics
- Follow existing telemetry patterns

### Phase 5: Error Handling and Testing

#### 8. Add Comprehensive Error Handling

**Error Scenarios:**

- Story generation failures
- Vitest not available/configured
- Network timeouts
- Component analysis failures
- Test execution failures

**User Feedback:**

- Progress indicators in modal
- Error messages for failures
- Graceful degradation when features unavailable

#### 9. Testing

**Test Strategy:**

- Unit tests for new APIs
- Integration tests for event flow
- E2E tests for complete modal flow
- Mock Vitest responses for testing

## Implementation Order

1. **Phase 1**: Define events and extract core logic
2. **Phase 2**: Implement core-server APIs
3. **Phase 3**: Integrate with modal UI
4. **Phase 4**: Add telemetry
5. **Phase 5**: Error handling and testing

## Technical Considerations

### Component Sampling Strategy

- Use existing `findEasyToStorybookComponents()` logic
- Sample 20 components total (not per directory)
- Prioritize by simplicity score
- Filter out components with existing stories

### Vitest Integration Challenges

- Ensure Vitest addon is loaded and configured
- Handle case where Vitest is not available
- Map story IDs to test files correctly
- Aggregate test results from multiple test runs

### Performance Considerations

- Story generation may take time (file analysis + writing)
- Test execution may be slow for 20 stories
- Implement proper loading states and cancellation
- Consider running operations in parallel where possible

### Error Recovery

- Allow users to retry failed operations
- Don't block modal functionality on flow failures
- Provide clear error messages and recovery options

## Success Criteria

- Modal opens and automatically triggers story generation flow
- 20 stories are generated using existing sampling logic
- Vitest tests run on generated stories
- Test results are collected and sent via telemetry
- Results are displayed in the modal UI
- Flow handles errors gracefully without breaking modal functionality
- All operations complete within reasonable time limits (< 30 seconds)

