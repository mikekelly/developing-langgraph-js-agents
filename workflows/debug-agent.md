# Workflow: Debug a LangGraph.js Agent

<required_reading>

**Read these reference files NOW:**
1. references/graph-api.md
2. references/anti-patterns.md

</required_reading>

<process>

## Step 1: Identify the Problem Type

| Symptom | Likely Cause | Jump to |
|---------|--------------|---------|
| TypeScript errors | Type mismatches, missing imports | Step 2 |
| "Graph not compiled" | Missing .compile() call | Step 3 |
| Agent hangs/loops forever | Non-terminating edges | Step 4 |
| State not updating | Missing reducers, wrong returns | Step 5 |
| Tools not being called | Bad descriptions, binding issues | Step 6 |
| Persistence not working | Missing checkpointer/thread_id | Step 7 |
| Unexpected node execution | Edge routing bugs | Step 8 |
| Runtime errors | Node implementation bugs | Step 9 |

## Step 2: Fix TypeScript Errors

**Common type issues:**

```typescript
// Error: Type mismatch in node return
// Fix: Return partial state, not full state
async function myNode(state: StateType) {
  return { updatedField: value };  // Good: partial
  // return { ...state, updatedField: value };  // Bad: full state
}

// Error: Annotation type inference
// Fix: Explicitly type the Annotation
const State = Annotation.Root({
  items: Annotation<string[]>({  // Explicit type
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

// Error: Message type issues
// Fix: Import and use proper types
import { BaseMessage, AIMessage, HumanMessage } from "@langchain/core/messages";
```

## Step 3: Fix Compilation Issues

**Graph must be compiled:**

```typescript
// Wrong: Using uncompiled graph
const workflow = new StateGraph(State)
  .addNode("a", nodeA)
  .addEdge(START, "a")
  .addEdge("a", END);

await workflow.invoke(input);  // Error!

// Right: Compile first
const graph = workflow.compile();
await graph.invoke(input);  // Works
```

## Step 4: Fix Infinite Loops

**Check edge conditions:**

```typescript
// Bug: Loop never exits
function route(state: StateType) {
  if (state.messages.at(-1)?.tool_calls?.length) {
    return "tools";
  }
  return "agent";  // Always goes back to agent!
}

// Fix: Add termination condition
function route(state: StateType) {
  const lastMessage = state.messages.at(-1);
  if (lastMessage?.tool_calls?.length) {
    return "tools";
  }
  return END;  // Exit when no tool calls
}
```

**Add loop counters for complex loops:**

```typescript
const State = Annotation.Root({
  ...MessagesAnnotation.spec,
  iterations: Annotation<number>({
    reducer: (x, y) => x + y,
    default: () => 0,
  }),
});

function route(state: StateType) {
  if (state.iterations >= 10) return END;  // Safety limit
  if (needsMoreWork(state)) return "worker";
  return END;
}
```

## Step 5: Fix State Update Issues

**Check reducers:**

```typescript
// Bug: Array overwrites instead of accumulates
const State = Annotation.Root({
  results: Annotation<string[]>(),  // No reducer = overwrite
});

// Fix: Add reducer
const State = Annotation.Root({
  results: Annotation<string[]>({
    reducer: (existing, new_) => existing.concat(new_),
    default: () => [],
  }),
});
```

**Check node returns:**

```typescript
// Bug: Returning undefined or wrong shape
async function myNode(state: StateType) {
  await doSomething();
  // Forgot to return!
}

// Fix: Always return state update
async function myNode(state: StateType) {
  const result = await doSomething();
  return { result };  // Explicit return
}
```

## Step 6: Fix Tool Calling Issues

**Check tool binding:**

```typescript
// Bug: Tools not bound to model
const model = new ChatAnthropic({ model: "claude-sonnet-4-5-20250929" });
// model.invoke() won't use tools!

// Fix: Bind tools
const modelWithTools = model.bindTools(tools);
```

**Check tool descriptions:**

```typescript
// Bug: Vague description
const tool = tool(fn, {
  name: "do_thing",
  description: "Does a thing",  // LLM won't know when to use this
  schema: z.object({ x: z.string() }),
});

// Fix: Clear, actionable description
const tool = tool(fn, {
  name: "search_products",
  description: "Search the product catalog. Use when user asks about products, inventory, or wants to find items.",
  schema: z.object({
    query: z.string().describe("Search terms"),
  }),
});
```

**Check tool name in toolsByName:**

```typescript
// Bug: Tool name mismatch
const searchTool = tool(fn, { name: "search_database", ... });
const toolsByName = { search: searchTool };  // Wrong key!

// Fix: Use tool's name property
const toolsByName = Object.fromEntries(
  tools.map(t => [t.name, t])
);
```

## Step 7: Fix Persistence Issues

**Check checkpointer:**

```typescript
// Bug: No checkpointer
const graph = workflow.compile();  // No persistence

// Fix: Add checkpointer
import { MemorySaver } from "@langchain/langgraph";
const graph = workflow.compile({
  checkpointer: new MemorySaver(),
});
```

**Check thread_id:**

```typescript
// Bug: Missing thread_id
await graph.invoke(input);  // Messages won't persist

// Fix: Provide thread_id
await graph.invoke(input, {
  configurable: { thread_id: "user-123" },
});
```

## Step 8: Debug Edge Routing

**Add logging to routing functions:**

```typescript
function route(state: StateType) {
  const lastMessage = state.messages.at(-1);
  const hasToolCalls = lastMessage?.tool_calls?.length > 0;

  console.log("Routing decision:", {
    lastMessageType: lastMessage?.getType(),
    hasToolCalls,
    toolCalls: lastMessage?.tool_calls,
  });

  if (hasToolCalls) return "tools";
  return END;
}
```

**Use stream mode "debug":**

```typescript
for await (const chunk of await graph.stream(input, {
  streamMode: "debug",
})) {
  console.log("Debug:", JSON.stringify(chunk, null, 2));
}
```

## Step 9: Debug Node Errors

**Wrap nodes with error handling:**

```typescript
async function myNode(state: StateType) {
  try {
    const result = await riskyOperation();
    return { result };
  } catch (error) {
    console.error("Node error:", error);
    return {
      messages: [new AIMessage(`Error: ${error.message}`)],
    };
  }
}
```

**Use stream mode to see execution:**

```typescript
for await (const chunk of await graph.stream(input, {
  streamMode: "updates",
})) {
  console.log("State update:", chunk);
}
```

## Step 10: Visualize the Graph

```typescript
const drawableGraph = await graph.getGraphAsync();
const mermaid = drawableGraph.drawMermaid();
console.log(mermaid);

// Or generate PNG
const png = await drawableGraph.drawMermaidPng();
```

</process>

<debugging_checklist>

Quick checks:
- [ ] Is the graph compiled? (`.compile()`)
- [ ] Are tools bound to the model? (`.bindTools()`)
- [ ] Do routing functions have exhaustive returns?
- [ ] Do accumulating state fields have reducers?
- [ ] Do nodes return partial state updates?
- [ ] Is thread_id provided for persistence?
- [ ] Are tool descriptions clear and actionable?

</debugging_checklist>

<success_criteria>

Debugging complete when:
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] TypeScript compiles
- [ ] Agent runs without errors
- [ ] Specific issue no longer reproduces
- [ ] No regressions in other functionality

</success_criteria>
