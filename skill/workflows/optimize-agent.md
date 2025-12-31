# Workflow: Optimize a LangGraph.js Agent

<required_reading>

**Read these reference files NOW:**
1. references/graph-api.md
2. references/streaming.md
3. references/anti-patterns.md

</required_reading>

<process>

## Step 1: Identify Performance Bottlenecks

Common bottlenecks in LangGraph agents:

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Slow response time | Sequential LLM calls | Parallelize where possible |
| High latency | No streaming | Add streaming |
| Memory issues | Large state accumulation | Trim/summarize messages |
| Repeated work | No caching | Add caching layer |
| Unnecessary LLM calls | Over-reliance on LLM routing | Use deterministic routing |

## Step 2: Add Streaming for Perceived Performance

Streaming significantly improves user experience by showing partial outputs:

```typescript
// Instead of waiting for full response
const result = await graph.invoke(input);

// Stream updates as they happen
for await (const chunk of await graph.stream(input, {
  streamMode: "messages",
})) {
  const [message, metadata] = chunk;
  if (metadata.langgraph_node === "agent") {
    process.stdout.write(message.content);
  }
}
```

**Stream modes:**
- `"values"` - Full state after each step
- `"updates"` - State delta after each step
- `"messages"` - LLM tokens as they generate
- `"custom"` - User-defined progress signals

## Step 3: Parallelize Independent Operations

**Use Promise.all for independent tool calls:**

```typescript
async function callTools(state: AgentStateType) {
  const lastMessage = state.messages.at(-1);

  if (!AIMessage.isInstance(lastMessage)) {
    return { messages: [] };
  }

  // Execute all tool calls in parallel
  const toolResults = await Promise.all(
    (lastMessage.tool_calls ?? []).map(async (toolCall) => {
      const tool = toolsByName[toolCall.name];
      return tool.invoke(toolCall);
    })
  );

  return { messages: toolResults };
}
```

**Parallel nodes in the graph:**

```typescript
// Multiple outgoing edges execute in parallel
const workflow = new StateGraph(State)
  .addNode("start", startNode)
  .addNode("research", researchNode)
  .addNode("analyze", analyzeNode)
  .addNode("combine", combineNode)
  .addEdge(START, "start")
  // These two run in parallel
  .addEdge("start", "research")
  .addEdge("start", "analyze")
  // Both must complete before combine
  .addEdge("research", "combine")
  .addEdge("analyze", "combine")
  .addEdge("combine", END);
```

## Step 4: Optimize State Management

**Trim conversation history:**

```typescript
import { trimMessages } from "@langchain/core/messages";

async function agentNode(state: AgentStateType) {
  // Trim to last N messages or token limit
  const trimmedMessages = await trimMessages(state.messages, {
    maxTokens: 4000,
    strategy: "last",
    tokenCounter: (msgs) => msgs.length * 100, // Estimate
    includeSystem: true,
    startOn: "human",
  });

  const response = await model.invoke(trimmedMessages);
  return { messages: [response] };
}
```

**Summarize old messages:**

```typescript
async function summarizeIfNeeded(state: AgentStateType) {
  if (state.messages.length < 20) {
    return {};
  }

  // Summarize older messages
  const oldMessages = state.messages.slice(0, -10);
  const summary = await summarizeModel.invoke([
    new SystemMessage("Summarize this conversation briefly:"),
    ...oldMessages,
  ]);

  return {
    messages: [
      new SystemMessage(`Previous conversation summary: ${summary.content}`),
      ...state.messages.slice(-10),
    ],
  };
}
```

## Step 5: Optimize Tool Calls

**Cache tool results:**

```typescript
const toolCache = new Map<string, { result: string; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

async function cachedTool({ query }: { query: string }) {
  const cacheKey = `search:${query}`;
  const cached = toolCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const result = await actualSearch(query);
  toolCache.set(cacheKey, { result, timestamp: Date.now() });
  return result;
}
```

**Batch similar tool calls:**

```typescript
async function batchedToolNode(state: AgentStateType) {
  const lastMessage = state.messages.at(-1);
  const toolCalls = lastMessage?.tool_calls ?? [];

  // Group by tool type
  const grouped = toolCalls.reduce((acc, call) => {
    (acc[call.name] ??= []).push(call);
    return acc;
  }, {} as Record<string, typeof toolCalls>);

  const results: ToolMessage[] = [];

  // Process each group efficiently
  for (const [toolName, calls] of Object.entries(grouped)) {
    if (toolName === "search" && calls.length > 1) {
      // Batch search queries
      const queries = calls.map((c) => c.args.query);
      const batchResults = await batchSearch(queries);
      calls.forEach((call, i) => {
        results.push(new ToolMessage({
          content: batchResults[i],
          tool_call_id: call.id,
        }));
      });
    } else {
      // Execute normally
      for (const call of calls) {
        const result = await toolsByName[call.name].invoke(call);
        results.push(result);
      }
    }
  }

  return { messages: results };
}
```

## Step 6: Reduce LLM Calls

**Use deterministic routing where possible:**

```typescript
// Instead of asking LLM to route
function smartRoute(state: AgentStateType) {
  const lastHuman = state.messages
    .filter((m) => m.getType() === "human")
    .at(-1);

  const content = lastHuman?.content?.toString().toLowerCase() ?? "";

  // Deterministic routing based on keywords
  if (content.includes("search") || content.includes("find")) {
    return "search";
  }
  if (content.includes("calculate") || content.includes("compute")) {
    return "calculate";
  }

  // Only use LLM for ambiguous cases
  return "llm_router";
}
```

**Avoid re-processing unchanged data:**

```typescript
const State = Annotation.Root({
  ...MessagesAnnotation.spec,
  lastProcessedIndex: Annotation<number>({
    default: () => 0,
  }),
});

async function processNode(state: StateType) {
  // Only process new messages
  const newMessages = state.messages.slice(state.lastProcessedIndex);

  if (newMessages.length === 0) {
    return {};
  }

  const result = await processMessages(newMessages);

  return {
    result,
    lastProcessedIndex: state.messages.length,
  };
}
```

## Step 7: Use Smaller Models Where Appropriate

```typescript
// Use fast model for simple tasks
const fastModel = new ChatAnthropic({
  model: "claude-3-5-haiku-20241022",
  temperature: 0,
});

// Use capable model for complex reasoning
const smartModel = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,
});

async function routerNode(state: StateType) {
  // Fast model for classification
  const classification = await fastModel.invoke([
    new SystemMessage("Classify: simple or complex"),
    ...state.messages,
  ]);
  return { taskType: classification.content };
}

async function executorNode(state: StateType) {
  // Choose model based on task
  const model = state.taskType === "complex" ? smartModel : fastModel;
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}
```

## Step 8: Measure and Monitor

```typescript
// Add timing to nodes
async function timedNode(state: StateType) {
  const start = performance.now();

  const result = await actualNodeLogic(state);

  const duration = performance.now() - start;
  console.log(`Node executed in ${duration.toFixed(2)}ms`);

  return result;
}

// Use LangSmith for observability
// Set LANGSMITH_API_KEY and LANGSMITH_TRACING=true
```

</process>

<optimization_checklist>

Quick wins:
- [ ] Add streaming for user-facing responses
- [ ] Parallelize independent tool calls
- [ ] Cache frequently-used tool results
- [ ] Trim/summarize long conversation history

Advanced:
- [ ] Use deterministic routing where possible
- [ ] Batch similar operations
- [ ] Use smaller models for simple tasks
- [ ] Add monitoring to identify bottlenecks

</optimization_checklist>

<success_criteria>

Optimization successful when:
- [ ] Response latency reduced (measure before/after)
- [ ] User perceives faster response (streaming)
- [ ] Memory usage is stable over long conversations
- [ ] No regressions in functionality
- [ ] Tests still pass

</success_criteria>
