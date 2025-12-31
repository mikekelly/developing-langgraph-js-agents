# Workflow: Write Tests for a LangGraph.js Agent

<required_reading>

**Read these reference files NOW:**
1. references/graph-api.md
2. references/state-management.md

</required_reading>

<process>

## Step 1: Set Up Testing Environment

```bash
# Install test dependencies
npm install -D vitest @vitest/coverage-v8

# Add test script to package.json
```

In `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
```

## Step 2: Test Individual Nodes (Unit Tests)

Access compiled graph nodes directly via `graph.nodes`:

```typescript
// tests/nodes.test.ts
import { describe, it, expect, vi } from 'vitest';
import { agent } from '../src/agent';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

describe('Agent Nodes', () => {
  it('callModel node returns AI message', async () => {
    // Access node directly (bypasses checkpointer)
    const result = await agent.nodes.agent.invoke({
      messages: [new HumanMessage('Hello')],
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toBeInstanceOf(AIMessage);
  });

  it('tools node executes tool calls', async () => {
    const mockToolCall = {
      id: 'call_1',
      name: 'my_tool',
      args: { param: 'test' },
    };

    const result = await agent.nodes.tools.invoke({
      messages: [
        new AIMessage({
          content: '',
          tool_calls: [mockToolCall],
        }),
      ],
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].name).toBe('my_tool');
  });
});
```

## Step 3: Test Tools in Isolation

```typescript
// tests/tools.test.ts
import { describe, it, expect } from 'vitest';
import { myTool, searchTool } from '../src/tools';

describe('Tools', () => {
  it('myTool returns expected result', async () => {
    const result = await myTool.invoke({ param: 'test' });
    expect(result).toContain('test');
  });

  it('searchTool handles empty results', async () => {
    const result = await searchTool.invoke({ query: 'nonexistent' });
    expect(result).toBeDefined();
  });

  it('tool has proper schema', () => {
    expect(myTool.name).toBe('my_tool');
    expect(myTool.description).toBeTruthy();
    expect(myTool.schema).toBeDefined();
  });
});
```

## Step 4: Test State Reducers

```typescript
// tests/state.test.ts
import { describe, it, expect } from 'vitest';
import { AgentState } from '../src/state';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

describe('State', () => {
  it('messages reducer concatenates', () => {
    const initial = AgentState.spec.messages.default?.() ?? [];
    const update1 = [new HumanMessage('Hello')];
    const update2 = [new AIMessage('Hi!')];

    const reducer = AgentState.spec.messages.reducer;
    const result1 = reducer?.(initial, update1) ?? update1;
    const result2 = reducer?.(result1, update2) ?? update2;

    expect(result2).toHaveLength(2);
  });

  it('custom field reducer works correctly', () => {
    // Test your custom reducers
    const initial = AgentState.spec.results?.default?.() ?? [];
    const reducer = AgentState.spec.results?.reducer;

    const result = reducer?.(initial, ['item1']) ?? ['item1'];
    expect(result).toContain('item1');
  });
});
```

## Step 5: Test Graph Integration

```typescript
// tests/agent.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import { AgentState } from '../src/state';
import { callModel, callTools } from '../src/nodes';

describe('Agent Integration', () => {
  let graph: ReturnType<typeof createTestGraph>;

  function createTestGraph() {
    return new StateGraph(AgentState)
      .addNode('agent', callModel)
      .addNode('tools', callTools)
      .addEdge(START, 'agent')
      .addConditionalEdges('agent', (state) => {
        if (state.messages.at(-1)?.tool_calls?.length) return 'tools';
        return END;
      })
      .addEdge('tools', 'agent')
      .compile({
        checkpointer: new MemorySaver(),
      });
  }

  beforeEach(() => {
    graph = createTestGraph();
  });

  it('completes simple conversation', async () => {
    const result = await graph.invoke(
      { messages: [new HumanMessage('Say hello')] },
      { configurable: { thread_id: 'test-1' } }
    );

    expect(result.messages.length).toBeGreaterThan(1);
    const lastMessage = result.messages.at(-1);
    expect(lastMessage?.content).toBeTruthy();
  });

  it('executes tools when needed', async () => {
    const result = await graph.invoke(
      { messages: [new HumanMessage('Use the search tool to find X')] },
      { configurable: { thread_id: 'test-2' } }
    );

    // Check that tool messages exist
    const toolMessages = result.messages.filter(
      (m) => m.getType() === 'tool'
    );
    expect(toolMessages.length).toBeGreaterThan(0);
  });

  it('maintains conversation across invocations', async () => {
    const threadId = 'test-3';

    await graph.invoke(
      { messages: [new HumanMessage('My name is Alice')] },
      { configurable: { thread_id: threadId } }
    );

    const result = await graph.invoke(
      { messages: [new HumanMessage('What is my name?')] },
      { configurable: { thread_id: threadId } }
    );

    const lastMessage = result.messages.at(-1);
    expect(lastMessage?.content?.toString().toLowerCase()).toContain('alice');
  });
});
```

## Step 6: Test Edge Routing

```typescript
// tests/routing.test.ts
import { describe, it, expect } from 'vitest';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { END } from '@langchain/langgraph';

// Import your routing function
import { shouldContinue } from '../src/agent';

describe('Routing', () => {
  it('routes to tools when tool calls present', () => {
    const state = {
      messages: [
        new AIMessage({
          content: '',
          tool_calls: [{ id: '1', name: 'test', args: {} }],
        }),
      ],
    };

    expect(shouldContinue(state)).toBe('tools');
  });

  it('routes to END when no tool calls', () => {
    const state = {
      messages: [new AIMessage({ content: 'Done!' })],
    };

    expect(shouldContinue(state)).toBe(END);
  });

  it('handles empty messages', () => {
    const state = { messages: [] };
    expect(shouldContinue(state)).toBe(END);
  });
});
```

## Step 7: Test with Mocked LLM

```typescript
// tests/mocked.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { StateGraph, START, END } from '@langchain/langgraph';
import { AgentState } from '../src/state';

describe('Agent with Mocked LLM', () => {
  it('handles mocked responses', async () => {
    // Create fake model with predetermined responses
    const fakeModel = new FakeListChatModel({
      responses: [
        new AIMessage({ content: 'Mocked response 1' }),
        new AIMessage({ content: 'Mocked response 2' }),
      ],
    });

    async function mockedAgent(state: typeof AgentState.State) {
      const response = await fakeModel.invoke(state.messages);
      return { messages: [response] };
    }

    const graph = new StateGraph(AgentState)
      .addNode('agent', mockedAgent)
      .addEdge(START, 'agent')
      .addEdge('agent', END)
      .compile();

    const result = await graph.invoke({
      messages: [new HumanMessage('Test')],
    });

    expect(result.messages.at(-1)?.content).toBe('Mocked response 1');
  });
});
```

## Step 8: Test Partial Execution

```typescript
// tests/partial.test.ts
import { describe, it, expect } from 'vitest';
import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';

describe('Partial Execution', () => {
  it('can interrupt and resume', async () => {
    const checkpointer = new MemorySaver();

    // Compile with interruptAfter
    const graph = workflow.compile({
      checkpointer,
      interruptAfter: ['agent'],
    });

    const threadId = 'interrupt-test';

    // First invocation stops after agent
    const partial = await graph.invoke(
      { messages: [new HumanMessage('Hello')] },
      { configurable: { thread_id: threadId } }
    );

    // Get state to verify pause
    const state = await graph.getState({
      configurable: { thread_id: threadId },
    });

    expect(state.next).toBeDefined();

    // Resume execution
    const final = await graph.invoke(null, {
      configurable: { thread_id: threadId },
    });

    expect(final.messages.length).toBeGreaterThan(partial.messages.length);
  });
});
```

## Step 9: Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx vitest tests/agent.test.ts

# Run in watch mode
npx vitest --watch
```

</process>

<test_organization>

```
tests/
├── unit/
│   ├── tools.test.ts      # Tool function tests
│   ├── nodes.test.ts      # Node function tests
│   ├── state.test.ts      # State/reducer tests
│   └── routing.test.ts    # Edge routing tests
├── integration/
│   ├── agent.test.ts      # Full graph tests
│   └── persistence.test.ts # Checkpointer tests
└── mocks/
    └── models.ts          # Mock LLM helpers
```

</test_organization>

<success_criteria>

Tests are complete when:
- [ ] All tools have unit tests
- [ ] All nodes have unit tests
- [ ] State reducers are tested
- [ ] Routing logic has coverage
- [ ] Integration tests verify graph execution
- [ ] Persistence is tested (if used)
- [ ] Tests pass consistently
- [ ] Coverage is reasonable (aim for 80%+)

</success_criteria>
