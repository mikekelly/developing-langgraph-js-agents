<overview>

Common mistakes when building LangGraph.js agents and how to avoid them.

</overview>

<state_mistakes>

## State Anti-Patterns

**Missing reducers for accumulating fields:**
```typescript
// BAD: Messages will overwrite, not accumulate
messages: Annotation<BaseMessage[]>()

// GOOD: Use reducer
messages: Annotation<BaseMessage[]>({
  reducer: (x, y) => x.concat(y),
})

// BEST: Use MessagesAnnotation
...MessagesAnnotation.spec
```

**Storing derived data:**
```typescript
// BAD: Redundant, can be computed
const State = Annotation.Root({
  items: Annotation<Item[]>(),
  itemCount: Annotation<number>(),  // Unnecessary
});

// GOOD: Compute in nodes
const count = state.items.length;
```

**Storing formatted prompts:**
```typescript
// BAD: Inflexible
prompt: Annotation<string>()  // "You are a helpful..."

// GOOD: Store raw data, format in nodes
context: Annotation<string[]>()
```

</state_mistakes>

<node_mistakes>

## Node Anti-Patterns

**Mutating state:**
```typescript
// BAD: Direct mutation
async function badNode(state) {
  state.items.push(newItem);  // Don't do this!
  return state;
}

// GOOD: Return updates
async function goodNode(state) {
  return { items: [newItem] };  // Reducer will merge
}
```

**Returning full state:**
```typescript
// BAD: Wasteful, may cause issues
return { ...state, newField: value };

// GOOD: Return only changed fields
return { newField: value };
```

**Forgetting to return:**
```typescript
// BAD: Returns undefined
async function badNode(state) {
  await doSomething();
  // Forgot return!
}

// GOOD: Explicit return
async function goodNode(state) {
  await doSomething();
  return {};  // Even empty object is fine
}
```

</node_mistakes>

<edge_mistakes>

## Edge Anti-Patterns

**Non-exhaustive routing:**
```typescript
// BAD: What if neither condition is true?
function route(state) {
  if (state.a) return "nodeA";
  if (state.b) return "nodeB";
  // Undefined return = bug!
}

// GOOD: Always have default
function route(state) {
  if (state.a) return "nodeA";
  if (state.b) return "nodeB";
  return END;
}
```

**Infinite loops:**
```typescript
// BAD: No exit condition
.addEdge("process", "process")

// GOOD: Conditional exit
.addConditionalEdges("process", (state) =>
  state.done ? END : "process"
)

// BETTER: Add iteration limit
const State = Annotation.Root({
  iterations: Annotation<number>({
    reducer: (x, y) => x + y,
    default: () => 0,
  }),
});

function route(state) {
  if (state.iterations >= 10) return END;  // Safety limit
  return state.done ? END : "process";
}
```

</edge_mistakes>

<graph_mistakes>

## Graph Anti-Patterns

**Forgetting to compile:**
```typescript
// BAD: Can't invoke uncompiled graph
const workflow = new StateGraph(State)
  .addNode("a", nodeA);
await workflow.invoke(input);  // Error!

// GOOD: Compile first
const graph = workflow.compile();
await graph.invoke(input);
```

**Orphan nodes:**
```typescript
// BAD: nodeB is never reached
const workflow = new StateGraph(State)
  .addNode("nodeA", nodeA)
  .addNode("nodeB", nodeB)  // Orphan!
  .addEdge(START, "nodeA")
  .addEdge("nodeA", END);
```

</graph_mistakes>

<tool_mistakes>

## Tool Anti-Patterns

**Vague descriptions:**
```typescript
// BAD: LLM won't know when to use
description: "Does stuff"

// GOOD: Clear trigger conditions
description: "Search products by name. Use when user asks about products or inventory."
```

**Missing tool binding:**
```typescript
// BAD: Model can't use tools
const model = new ChatAnthropic({ model: "claude-sonnet-4-5-20250929" });

// GOOD: Bind tools
const model = new ChatAnthropic({ model: "claude-sonnet-4-5-20250929" })
  .bindTools(tools);
```

**Tool name mismatch:**
```typescript
// BAD: Name doesn't match
const tool = tool(fn, { name: "search_db", ... });
const toolsByName = { search: tool };  // Wrong key!

// GOOD: Use tool.name
const toolsByName = Object.fromEntries(
  tools.map(t => [t.name, t])
);
```

</tool_mistakes>

<persistence_mistakes>

## Persistence Anti-Patterns

**Missing thread_id:**
```typescript
// BAD: No persistence without thread_id
await graph.invoke(input);

// GOOD: Provide thread_id
await graph.invoke(input, {
  configurable: { thread_id: "user-123" },
});
```

**MemorySaver in production:**
```typescript
// BAD: Data lost on restart
const checkpointer = new MemorySaver();

// GOOD: Use persistent storage
const checkpointer = PostgresSaver.fromConnString(DB_URL);
```

</persistence_mistakes>

<performance_mistakes>

## Performance Anti-Patterns

**Sequential tool execution:**
```typescript
// BAD: One at a time
for (const call of toolCalls) {
  const result = await tool.invoke(call);
}

// GOOD: Parallel execution
const results = await Promise.all(
  toolCalls.map(call => tool.invoke(call))
);
```

**Unbounded message history:**
```typescript
// BAD: Context grows forever
messages: Annotation<BaseMessage[]>({
  reducer: (x, y) => x.concat(y),
})

// GOOD: Trim or summarize
const trimmed = await trimMessages(state.messages, {
  maxTokens: 4000,
});
```

</performance_mistakes>
